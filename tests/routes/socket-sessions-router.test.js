import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import Middlewares from "../../src/middlewares/middlewares.js";
import createSocketSessionsRouter from "../../src/routes/socket-sessions-router.js";

describe("SocketSessionsRouter", () => {
    const socketSessionsController = { create: vi.fn((req, res) => res.status(201).send()), refresh: vi.fn(), close: vi.fn() };
    let origin;
    let server;

    beforeAll(async () => {
        const app = express();
        const requireAuth = Middlewares.requireAuth({ accessTokenProvider: { verify: vi.fn(() => ({ id: "user-id" })) } });
        app.use("/socket-sessions", createSocketSessionsRouter({ socketSessionsController, requireAuth }));
        app.use(Middlewares.routeNotFound, Middlewares.errorHandler);
        server = app.listen(0, "127.0.0.1");
        await new Promise((resolve) => server.once("listening", resolve));
        origin = `http://127.0.0.1:${server.address().port}`;
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterAll(async () => {
        await new Promise((resolve) => server.close(resolve));
    });

    it("should keep session endpoints authenticated", async () => {
        const response = await fetch(`${origin}/socket-sessions`, { method: "POST" });
        expect(response.status).toBe(401);
        expect(socketSessionsController.create).not.toHaveBeenCalled();
    });

    it("should report unknown session endpoints before requiring authentication", async () => {
        const response = await fetch(`${origin}/socket-sessions/not-found`);
        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toMatchObject({ code: "ROUTE_NOT_FOUND" });
    });
});
