import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import WebSocket from "ws";
import SocketGateway from "../../../src/utils/gateways/socket-gateway.js";
import ApiError from "../../../src/utils/error/api-error.js";

describe("SocketGateway", () => {
    const authUser = { id: "user-id", exp: 1_900_000_000, roles: ["NET"] };
    let accessTokenProvider;
    let socketSessionsFacade;
    let gateway;
    let server;
    let origin;

    beforeEach(async () => {
        accessTokenProvider = { verify: vi.fn(() => authUser) };
        socketSessionsFacade = {
            subscribe: vi.fn(),
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

    it("should authenticate and subscribe from the first message", async () => {
        const webSocket = await openSocket(`${origin}/events/session-id`);
        webSocket.send(JSON.stringify({ accessToken: "access-token", entities: ["devices"] }));
        await vi.waitFor(() => expect(socketSessionsFacade.subscribe).toHaveBeenCalledOnce());
        expect(accessTokenProvider.verify).toHaveBeenCalledWith({ token: "access-token" });
        expect(socketSessionsFacade.subscribe).toHaveBeenCalledWith(expect.objectContaining({
            authUser,
            entities: ["devices"],
            id: "session-id",
            webSocket: expect.any(Object)
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

    it("should return an error and close when the subscription is rejected", async () => {
        socketSessionsFacade.subscribe.mockImplementation(() => {
            throw new ApiError({ message: "forbidden", status: 403, apiError: "ACL_PERMISSION_DENIED" });
        });
        const webSocket = await openSocket(`${origin}/events/session-id`);
        webSocket.send(JSON.stringify({ accessToken: "access-token", entities: ["users"] }));
        await expectMessage(webSocket, { code: "ACL_PERMISSION_DENIED", message: "forbidden" });
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
