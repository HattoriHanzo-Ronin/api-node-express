import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import SocketSessionsService from "../../src/services/socket-sessions-service.js";

const testEnvironment = vi.hoisted(() => ({
    socketMaxConnections: 300,
    socketMaxConnectionsPerUser: 3,
    socketSessionInactivityTimeout: 15 * 60 * 1000,
    socketPingTimeout: 1000,
    protectedUsers: {}
}));

vi.mock("../../src/config/environment.js", () => ({ ENV: testEnvironment }));

const authUser = { id: "user-id", exp: 1_900_000_000 };

describe("SocketSessionsService", () => {
    let service;

    beforeEach(() => {
        Object.assign(testEnvironment, {
            socketMaxConnections: 300,
            socketMaxConnectionsPerUser: 3,
            socketSessionInactivityTimeout: 15 * 60 * 1000,
            socketPingTimeout: 1000,
            protectedUsers: {}
        });
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-28T00:00:00.000Z"));
        service = new SocketSessionsService();
    });

    afterEach(() => {
        service.closeAll();
        vi.useRealTimers();
    });

    it("should create a session with an expiration date", () => {
        const session = service.create({ authUser });
        expect(session.expiresAt).toBe("2026-10-28T00:15:00.000Z");
        expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("should not limit orphan sessions", () => {
        service.create({ authUser });
        service.create({ authUser });
        service.create({ authUser });
        expect(() => service.create({ authUser })).not.toThrow();
    });

    it("should reject a refresh from another user", () => {
        const { id } = service.create({ authUser });
        expect(() => service.refresh({ authUser: { ...authUser, id: "other-user" }, id })).toThrow(
            expect.objectContaining({ code: "SOCKET_SESSION_INVALID" })
        );
    });

    it("should close a session after inactivity", async () => {
        const { id } = service.create({ authUser });
        await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
        expect(() => service.refresh({ authUser, id })).toThrow(expect.objectContaining({ code: "SOCKET_SESSION_NOT_FOUND" }));
    });

    it("should close only the requested owned session", () => {
        const first = service.create({ authUser });
        const second = service.create({ authUser });
        service.close({ authUser, id: first.id });
        expect(() => service.refresh({ authUser, id: first.id })).toThrow();
        expect(service.refresh({ authUser, id: second.id })).toMatchObject({ id: second.id });
    });

    it("should reject a fourth active connection after confirming the existing sockets respond", async () => {
        const sessions = Array.from({ length: 4 }, () => service.create({ authUser }));
        for (const { id } of sessions.slice(0, 3)) {
            await service.connect({ authUser, id, webSocket: createWebSocket() });
        }

        await expect(service.connect({ authUser, id: sessions[3].id, webSocket: createWebSocket() }))
            .rejects.toMatchObject({ code: "SOCKET_CONNECTION_LIMIT_REACHED" });
    });

    it("should reuse capacity from a socket that does not answer ping", async () => {
        const sessions = Array.from({ length: 4 }, () => service.create({ authUser }));
        await service.connect({ authUser, id: sessions[0].id, webSocket: createWebSocket() });
        await service.connect({ authUser, id: sessions[1].id, webSocket: createWebSocket({ responds: false }) });
        await service.connect({ authUser, id: sessions[2].id, webSocket: createWebSocket() });
        const connection = service.connect({ authUser, id: sessions[3].id, webSocket: createWebSocket() });
        await vi.advanceTimersByTimeAsync(1000);
        await expect(connection).resolves.toBeUndefined();
    });

    it("should preserve reserved global capacity for protected users", async () => {
        Object.assign(testEnvironment, { socketMaxConnections: 3, protectedUsers: { "protected-user": { socket: 3 } } });
        vi.resetModules();
        const { default: ReservedSocketSessionsService } = await import("../../src/services/socket-sessions-service.js");
        const reservedService = new ReservedSocketSessionsService();
        const regularSession = reservedService.create({ authUser });
        const protectedUser = { ...authUser, id: "protected-user" };
        const protectedSession = reservedService.create({ authUser: protectedUser });

        await expect(reservedService.connect({ authUser, id: regularSession.id, webSocket: createWebSocket() }))
            .rejects.toMatchObject({ code: "SOCKET_CONNECTION_CAPACITY_REACHED" });
        await expect(reservedService.connect({ authUser: protectedUser, id: protectedSession.id, webSocket: createWebSocket() }))
            .resolves.toBeUndefined();
        reservedService.closeAll();
    });

    it("should notify only sockets subscribed to the changed entity", async () => {
        const first = service.create({ authUser });
        const second = service.create({ authUser });
        const firstSocket = { readyState: WebSocket.OPEN, send: vi.fn(), close: vi.fn() };
        const secondSocket = { readyState: WebSocket.OPEN, send: vi.fn(), close: vi.fn() };
        await service.connect({ authUser, id: first.id, webSocket: firstSocket });
        service.subscribe({ id: first.id, webSocket: firstSocket, entities: ["devices"] });
        await service.connect({ authUser, id: second.id, webSocket: secondSocket });
        service.subscribe({ id: second.id, webSocket: secondSocket, entities: ["users"] });

        service.notify({ entity: "devices" });

        expect(firstSocket.send).toHaveBeenCalledWith(JSON.stringify({ entity: "devices" }));
        expect(secondSocket.send).not.toHaveBeenCalled();
    });
});

function createWebSocket({ responds = true } = {}) {
    const webSocket = new EventEmitter();
    webSocket.readyState = WebSocket.OPEN;
    webSocket.close = vi.fn();
    webSocket.send = vi.fn();
    webSocket.terminate = vi.fn();
    webSocket.ping = vi.fn(() => {
        if (responds) {
            webSocket.emit("pong");
        }
    });
    return webSocket;
}
