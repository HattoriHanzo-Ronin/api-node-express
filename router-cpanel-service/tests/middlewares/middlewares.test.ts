import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import Middlewares from "../../src/middlewares/middlewares.js";
import ApiError from "../../src/utils/error/api-error.js";

const logger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("../../src/utils/logger/logger.js", () => ({ default: { getLogger: () => logger } }));

describe("error handler", () => {
    it.each([404, 500])("responds to controlled errors without another log (%s)", async (status) => {
        const error = new ApiError({ message: "controlled", status, cause: new Error("original") });
        const app = express();
        app.get("/", () => {
            throw error;
        });
        app.use(Middlewares.errorHandler);
        const server = app.listen(0);
        vi.clearAllMocks();
        try {
            const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
            expect(response.status).toBe(status);
            expect(await response.json()).toEqual({ code: error.code, message: "controlled" });
            expect(logger.error).not.toHaveBeenCalled();
            expect(logger.info).not.toHaveBeenCalled();
            expect(logger.warn).not.toHaveBeenCalled();
        } finally {
            await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
        }
    });

    it("records unhandled errors without exposing them to clients", async () => {
        const error = new Error("internal details");
        const app = express();
        app.get("/", () => {
            throw error;
        });
        app.use(Middlewares.errorHandler);
        const server = app.listen(0);
        vi.clearAllMocks();
        try {
            const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
            expect(response.status).toBe(500);
            expect(await response.json()).toMatchObject({ message: "Error inesperado" });
            expect(logger.error).toHaveBeenCalledOnce();
            expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ error }));
        } finally {
            await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
        }
    });
});
