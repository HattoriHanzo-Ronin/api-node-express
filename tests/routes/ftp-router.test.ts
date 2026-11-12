import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import Middlewares from "../../src/middlewares/middlewares.js";
import type { AuthAccessTokenPayload, VerifiedAccessToken } from "../../src/types/auth/auth-facade.js";
import type TokenProvider from "../../src/utils/token-providers/token-provider.js";
import type { FtpRouterDependencies } from "../../src/types/ftp/ftp-router.js";
import type { FtpRouterController } from "../types/routers.js";
vi.mock("../../src/utils/logger/logger.js", () => {
    return {
        default: { getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }
    };
});

import createFtpRouter from "../../src/routes/ftp-router.js";

describe("FtpRouter", () => {
    const ftpController: FtpRouterController = {
        streamMedia: vi.fn((req, res) => res.status(204).send()),
        dir: vi.fn(),
        getThumbnail: vi.fn(),
        makeDir: vi.fn(),
        move: vi.fn(),
        rename: vi.fn(),
        createUpload: vi.fn(),
        uploadEntry: vi.fn(),
        completeUpload: vi.fn(),
        cancelTransfer: vi.fn(),
        createDownload: vi.fn(),
        downloadEntry: vi.fn(),
        delete: vi.fn()
    };
    const accessTokenProvider: TokenProvider<AuthAccessTokenPayload, VerifiedAccessToken> = {
        create: vi.fn(),
        verify: vi.fn()
    };
    let origin: string;
    let server: Server;

    beforeAll(async () => {
        const app = express();
        const requireAuth = Middlewares.requireAuth({ accessTokenProvider });
        app.use(
            "/ftp",
            createFtpRouter({
                ftpController: ftpController as unknown as FtpRouterDependencies["ftpController"],
                requireAuth
            })
        );
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

    it("should expose media sessions", async () => {
        const response = await fetch(`${origin}/ftp/media/550e8400-e29b-41d4-a716-446655440000`);
        expect(response.status).toBe(204);
        expect(ftpController.streamMedia).toHaveBeenCalledOnce();
    });

    it("should keep the remaining FTP endpoints authenticated", async () => {
        const response = await fetch(`${origin}/ftp`);
        expect(response.status).toBe(401);
        expect(ftpController.dir).not.toHaveBeenCalled();
    });

    it("should report unknown FTP endpoints before requiring authentication", async () => {
        const response = await fetch(`${origin}/ftp/not-found`);
        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toMatchObject({ code: "ROUTE_NOT_FOUND" });
    });
});
