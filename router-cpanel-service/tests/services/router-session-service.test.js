import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    mkdtemp: vi.fn(),
    rm: vi.fn(),
    launch: vi.fn(),
    createConnection: vi.fn(),
    spawn: vi.fn()
}));

vi.mock("../../src/config/environment.js", () => ({
    ENV: {
        publicUrl: "https://router-cpanel.example",
        chromePath: "/usr/bin/chromium",
        displayBase: 100,
        vncPortBase: 5900,
        maxActiveUsers: 1,
        maxSessionsPerUser: 1,
        maxVncConnectionsPerSession: 1,
        sessionInactivityTimeout: 600_000,
        jwtAccessTokenExpiresIn: "30min"
    }
}));

vi.mock("node:fs/promises", () => ({ mkdtemp: mocks.mkdtemp, rm: mocks.rm }));
vi.mock("node:net", () => ({ createConnection: mocks.createConnection }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("puppeteer-core", () => ({ default: { launch: mocks.launch } }));

import RouterSessionService from "../../src/services/router-session-service.js";
import { JwtProvider } from "../../src/utils/token-providers/impl/jwt-provider.js";

describe("RouterSessionService", () => {
    let tokenProvider;

    beforeEach(() => {
        const page = { on: vi.fn(), setViewport: vi.fn(), goto: vi.fn(), url: vi.fn(() => "http://router.local"), frames: vi.fn(() => []), goBack: vi.fn(), reload: vi.fn() };
        const browser = { pages: vi.fn().mockResolvedValue([page]), newPage: vi.fn().mockResolvedValue(page), close: vi.fn().mockResolvedValue() };
        mocks.browser = browser;
        mocks.page = page;
        mocks.mkdtemp.mockResolvedValue("/tmp/router-cpanel-session");
        mocks.rm.mockResolvedValue();
        mocks.launch.mockResolvedValue(browser);
        mocks.createConnection.mockImplementation(() => createVncSocket());
        mocks.spawn.mockImplementation(() => createChildProcess());
        tokenProvider = new JwtProvider({ secret: "router-cpanel-jwt-secret", expiresIn: "30min" });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it("should create a mobile viewer session", async () => {
        const service = createService({ tokenProvider });
        const session = await service.create({
            ownerId: "user-id",
            routerName: "Router principal",
            routerIp: "router.local",
            language: "es-ES",
            clientType: "mobile",
            theme: "light"
        });
        const viewerUrl = new URL(session.url);
        expect(viewerUrl.origin).toBe("https://router-cpanel.example");
        expect(viewerUrl.pathname).toBe("/viewer/");
        expect(viewerUrl.searchParams.get("client")).toBe("mobile");
        expect(viewerUrl.searchParams.get("title")).toBe("Router principal");
        expect(viewerUrl.searchParams.get("language")).toBe("es-ES");
        expect(viewerUrl.searchParams.get("theme")).toBe("light");
        expect(viewerUrl.searchParams.get("path")).toMatch(/^\/vnc\/.+\/socket\?token=.+$/);
        expect(mocks.page.setViewport).toHaveBeenCalledWith({ width: 900, height: 1600 });
        expect(mocks.browser.newPage).not.toHaveBeenCalled();
        const token = new URL(viewerUrl.searchParams.get("path"), "ws://router-cpanel.example").searchParams.get("token");
        expect(tokenProvider.verify({ token })).toMatchObject({ sid: session.id });
        await service.close({ sessionId: session.id });
        await expect(service.openVncSocket({ sessionId: session.id, token })).rejects.toMatchObject({
            code: "ROUTER_SESSION_INVALID",
            status: 401
        });
    });

    it("should autofill the router password through a browser frame", async () => {
        const frame = { evaluate: vi.fn().mockResolvedValue(true) };
        mocks.page.frames.mockReturnValue([frame]);
        const service = createService({ tokenProvider });
        const session = await service.create({
            ownerId: "user-id",
            routerName: "Router principal",
            routerIp: "router.local",
            routerPassword: "secret",
            language: "es-ES",
            clientType: "desktop"
        });
        await vi.waitFor(() => expect(frame.evaluate).toHaveBeenCalledTimes(1));
        expect(frame.evaluate).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ password: "secret" }));
        await service.close({ sessionId: session.id });
    });

    it("should not autofill a page outside the router host", async () => {
        const frame = { evaluate: vi.fn().mockResolvedValue(true) };
        mocks.page.url.mockReturnValue("https://external.example");
        mocks.page.frames.mockReturnValue([frame]);
        const service = createService({ tokenProvider });
        const session = await service.create({
            ownerId: "user-id",
            routerName: "Router principal",
            routerIp: "router.local",
            routerPassword: "secret",
            clientType: "desktop"
        });
        await new Promise((resolve) => setImmediate(resolve));
        expect(frame.evaluate).not.toHaveBeenCalled();
        await service.close({ sessionId: session.id });
    });

    it("should navigate an active browser session", async () => {
        const service = createService({ tokenProvider });
        const session = await service.create({
            ownerId: "user-id",
            routerName: "Router principal",
            routerIp: "router.local",
            language: "es-ES",
            clientType: "desktop"
        });
        mocks.page.url.mockReturnValue("http://router.local/child");
        await service.navigate({ sessionId: session.id, ownerId: "user-id", action: "back" });
        await service.navigate({ sessionId: session.id, ownerId: "user-id", action: "reload" });
        expect(mocks.page.goBack).toHaveBeenCalledWith({ waitUntil: "domcontentloaded", timeout: 30_000 });
        expect(mocks.page.reload).toHaveBeenCalledWith({ waitUntil: "domcontentloaded", timeout: 30_000 });
        await service.close({ sessionId: session.id });
    });

    it("should not navigate back from the initial router route", async () => {
        const service = createService({ tokenProvider });
        const session = await service.create({ ownerId: "user-id", routerName: "Router principal", routerIp: "router.local", clientType: "desktop" });
        await service.navigate({ sessionId: session.id, ownerId: "user-id", action: "back" });
        expect(mocks.page.goBack).not.toHaveBeenCalled();
        await service.close({ sessionId: session.id });
    });

    it("should reject navigation for a missing browser session", async () => {
        const service = createService({ tokenProvider });
        await expect(service.navigate({ sessionId: "missing", ownerId: "user-id", action: "back" })).rejects.toMatchObject({
            code: "ROUTER_SESSION_NOT_FOUND",
            status: 404
        });
    });

    it("should reject an action from a different session owner", async () => {
        const service = createService({ tokenProvider });
        const session = await service.create({ ownerId: "user-id", routerName: "Router", routerIp: "router.local" });
        await expect(service.navigate({ sessionId: session.id, ownerId: "other-user-id", action: "back" })).rejects.toMatchObject({
            code: "ROUTER_SESSION_NOT_FOUND",
            status: 404
        });
        await service.close({ sessionId: session.id });
    });

    it("should translate profile creation errors", async () => {
        mocks.mkdtemp.mockRejectedValue(new Error("No space left on device"));
        const service = createService({ tokenProvider });
        await expect(service.create({ ownerId: "user-id", routerName: "Router", routerIp: "router.local" })).rejects.toMatchObject({
            code: "ROUTER_SESSION_FAILED",
            status: 500
        });
    });

    it("should replace an owner's active session", async () => {
        const service = createService({ tokenProvider });
        const firstSession = await service.create({ ownerId: "user-id", routerName: "Router", routerIp: "router.local" });
        const secondSession = await service.create({ ownerId: "user-id", routerName: "Router", routerIp: "router.local" });
        expect(secondSession.id).not.toBe(firstSession.id);
        expect(mocks.launch).toHaveBeenCalledTimes(2);
        await expect(service.openVncSocket({ sessionId: firstSession.id, token: "token" })).rejects.toMatchObject({
            code: "ROUTER_SESSION_INVALID",
            status: 401
        });
        await service.close({ sessionId: secondSession.id });
    });

    it("should reject a new owner when the active user capacity is reached", async () => {
        const service = createService({ tokenProvider });
        const session = await service.create({ ownerId: "user-id", routerName: "Router", routerIp: "router.local" });
        await expect(service.create({ ownerId: "other-user-id", routerName: "Other router", routerIp: "router.local" })).rejects.toMatchObject({
            code: "ROUTER_SESSION_CAPACITY_REACHED",
            status: 429
        });
        await service.close({ sessionId: session.id });
    });

    it("should close a session after ten inactive minutes", async () => {
        vi.useFakeTimers();
        const service = createService({ tokenProvider });
        const session = await service.create({ ownerId: "user-id", routerName: "Router", routerIp: "router.local" });
        await vi.advanceTimersByTimeAsync(600_000);
        await expect(service.openVncSocket({ sessionId: session.id, token: "token" })).rejects.toMatchObject({
            code: "ROUTER_SESSION_INVALID",
            status: 401
        });
    });

    it("should renew the inactivity timeout when the session is used", async () => {
        vi.useFakeTimers();
        const service = createService({ tokenProvider });
        const session = await service.create({ ownerId: "user-id", routerName: "Router", routerIp: "router.local" });
        await vi.advanceTimersByTimeAsync(599_999);
        service.refresh({ sessionId: session.id });
        await vi.advanceTimersByTimeAsync(599_999);
        expect(mocks.browser.close).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await Promise.resolve();
        expect(mocks.browser.close).toHaveBeenCalledTimes(1);
    });

    it("should limit VNC connections for a browser session", async () => {
        const service = createService({ tokenProvider });
        const session = await service.create({ ownerId: "user-id", routerName: "Router", routerIp: "router.local", clientType: "desktop" });
        const token = getViewerToken(session.url);
        const firstSocket = await service.openVncSocket({ sessionId: session.id, token });
        await expect(service.openVncSocket({ sessionId: session.id, token })).rejects.toMatchObject({
            code: "ROUTER_SESSION_CONNECTION_CAPACITY_REACHED",
            status: 429
        });
        firstSocket.destroy();
        await expect(service.openVncSocket({ sessionId: session.id, token })).resolves.toBeInstanceOf(EventEmitter);
        await service.close({ sessionId: session.id });
    });
});

function createService({ tokenProvider }) {
    return new RouterSessionService({ tokenProvider });
}

function getViewerToken(url) {
    const viewerUrl = new URL(url);
    return new URL(viewerUrl.searchParams.get("path"), viewerUrl.origin).searchParams.get("token");
}

function createChildProcess() {
    const childProcess = new EventEmitter();
    childProcess.kill = vi.fn();
    queueMicrotask(() => childProcess.emit("spawn"));
    return childProcess;
}

function createVncSocket() {
    const socket = new EventEmitter();
    socket.destroy = vi.fn(() => socket.emit("close"));
    queueMicrotask(() => socket.emit("connect"));
    return socket;
}
