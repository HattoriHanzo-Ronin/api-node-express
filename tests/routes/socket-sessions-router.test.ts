import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import Middlewares from "../../src/middlewares/middlewares.js";
import type { AuthAccessTokenPayload, VerifiedAccessToken } from "../../src/types/auth.js";
import type TokenProvider from "../../src/utils/token-providers/token-provider.js";
import type { SocketSessionsRouterController } from "../types/routers.js";
import createSocketSessionsRouter from "../../src/routes/socket-sessions-router.js";

describe("SocketSessionsRouter", () => {
    const authUser: VerifiedAccessToken = { id: "user-id", roles: ["NET"], iat: 1_800_000_000, exp: 1_900_000_000 };
    const socketSessionsController: SocketSessionsRouterController = {
        create: vi.fn((req, res) => res.status(201).send()),
        refresh: vi.fn(),
        close: vi.fn()
    };
    const accessTokenProvider: TokenProvider<AuthAccessTokenPayload, VerifiedAccessToken> = {
        create: vi.fn(),
        verify: vi.fn(() => authUser)
    };
    let origin: string;
    let server: Server;

    beforeAll(async () => {
        const app = express();
        const requireAuth = Middlewares.requireAuth({ accessTokenProvider });
        app.use("/socket-sessions", createSocketSessionsRouter({ socketSessionsController, requireAuth }));
        app.use(Middlewares.routeNotFound, Middlewares.errorHandler);
        server = app.listen(0, "127.0.0.1");
        await new Promise((resolve) => server.once("listening", resolve));
        const address = server.address();
        if (!address || typeof address === "string") {
            throw new Error("El servidor de prueba no tiene una dirección TCP");
        }

        origin = `http://127.0.0.1:${address.port}`;
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
