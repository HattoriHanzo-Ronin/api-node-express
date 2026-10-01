import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import Middlewares from "../../src/middlewares/middlewares.js";

vi.mock("../../src/config/environment.js", () => ({
    ENV: { thumbnailGeneratorUrl: "http://thumbnail-generator:3000" }
}));

import createFtpRouter from "../../src/routes/ftp-router.js";

describe("FtpRouter", () => {
    const ftpController = {
        streamMedia: vi.fn((req, res) => res.status(204).send()),
        dir: vi.fn(),
        getThumbnail: vi.fn(),
        makeDir: vi.fn(),
        move: vi.fn(),
        rename: vi.fn(),
        upload: vi.fn(),
        download: vi.fn(),
        delete: vi.fn()
    };
    let origin;
    let server;

    beforeAll(async () => {
        const app = express();
        app.use("/ftp", createFtpRouter({ ftpController }));
        app.use(Middlewares.errorHandler);
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

    it("should expose media sessions only to the configured service origin", async () => {
        const response = await fetch(`${origin}/ftp/media/550e8400-e29b-41d4-a716-446655440000`, {
            headers: { Origin: "http://thumbnail-generator:3000" }
        });
        expect(response.status).toBe(204);
        expect(ftpController.streamMedia).toHaveBeenCalledOnce();
    });

    it("should reject media sessions from other origins", async () => {
        const response = await fetch(`${origin}/ftp/media/550e8400-e29b-41d4-a716-446655440000`, {
            headers: { Origin: "http://other-service:3000" }
        });
        expect(response.status).toBe(500);
        expect(ftpController.streamMedia).not.toHaveBeenCalled();
    });

    it("should keep the remaining FTP endpoints authenticated", async () => {
        const response = await fetch(`${origin}/ftp`);
        expect(response.status).toBe(401);
        expect(ftpController.dir).not.toHaveBeenCalled();
    });
});
