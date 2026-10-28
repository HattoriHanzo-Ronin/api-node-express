import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import WebSocket from "ws";
import SocketGateway from "../../../src/utils/gateways/socket-gateway.js";

describe("SocketGateway", () => {
    const authUser = { id: "user-id", exp: 1_900_000_000 };
    let accessTokenProvider;
    let socketSessionsFacade;
    let gateway;
    let server;
    let origin;

    beforeEach(async () => {
        accessTokenProvider = { verify: vi.fn(() => authUser) };
        socketSessionsFacade = {
            connect: vi.fn(),
            getVersions: vi.fn(async () => ({ devices: "2" })),
            disconnect: vi.fn(),
            invalidate: vi.fn()
        };
        gateway = new SocketGateway({ socketSessionsFacade, accessTokenProvider });
        server = createServer();
        gateway.attach({ server });
        server.listen(0, "127.0.0.1");
        await new Promise((resolve) => server.once("listening", resolve));
        origin = `ws://127.0.0.1:${server.address().port}`;
    });

    afterEach(async () => {
        gateway.close();
        await new Promise((resolve) => server.close(resolve));
    });

    it("should bind a session while answering the first version query", async () => {
        const webSocket = await openSocket(`${origin}/events/session-id`);
        webSocket.send(JSON.stringify({ accessToken: "access-token", entities: ["devices"] }));
        await expectMessage(webSocket, { devices: "2" });
        expect(accessTokenProvider.verify).toHaveBeenCalledWith({ token: "access-token" });
        expect(socketSessionsFacade.connect).toHaveBeenCalledWith(expect.objectContaining({
            authUser,
            id: "session-id",
            webSocket: expect.any(Object)
        }));
        webSocket.close();
    });

    it("should validate every version query", async () => {
        const webSocket = await openSocket(`${origin}/events/session-id`);
        webSocket.send(JSON.stringify({ accessToken: "first-token", entities: ["devices"] }));
        await expectMessage(webSocket, { devices: "2" });
        webSocket.send(JSON.stringify({ accessToken: "refreshed-token", entities: ["devices"] }));
        await expectMessage(webSocket, { devices: "2" });
        expect(accessTokenProvider.verify).toHaveBeenLastCalledWith({ token: "refreshed-token" });
        expect(socketSessionsFacade.getVersions).toHaveBeenLastCalledWith(expect.objectContaining({
            authUser,
            id: "session-id",
            webSocket: expect.any(Object)
        }));
        webSocket.close();
    });

    it("should return requested authorized versions", async () => {
        const webSocket = await openSocket(`${origin}/events/session-id`);
        webSocket.send(JSON.stringify({ accessToken: "access-token", entities: ["devices"] }));
        await expectMessage(webSocket, { devices: "2" });
        expect(socketSessionsFacade.getVersions).toHaveBeenCalledWith(expect.objectContaining({
            authUser,
            dir: ".",
            entities: ["devices"],
            id: "session-id"
        }));
        webSocket.close();
    });

    it("should invalidate a session when authentication fails", async () => {
        accessTokenProvider.verify.mockImplementation(() => { throw new Error("invalid token"); });
        const webSocket = await openSocket(`${origin}/events/session-id`);
        webSocket.send(JSON.stringify({ accessToken: "invalid-token", entities: ["devices"] }));
        await expectMessage(webSocket, { code: "INVALID_TOKEN" });
        await new Promise((resolve) => webSocket.once("close", resolve));
        expect(socketSessionsFacade.invalidate).toHaveBeenCalledWith({ id: "session-id" });
    });
});

function openSocket(url) {
    return new Promise((resolve, reject) => {
        const webSocket = new WebSocket(url);
        webSocket.once("open", () => resolve(webSocket));
        webSocket.once("error", reject);
    });
}

function expectMessage(webSocket, result) {
    return new Promise((resolve) => {
        webSocket.once("message", (data) => {
            expect(JSON.parse(data.toString())).toMatchObject(result);
            resolve();
        });
    });
}
