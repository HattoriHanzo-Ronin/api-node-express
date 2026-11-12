import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import Middlewares from "../../src/middlewares/middlewares.js";
import ApiError from "../../src/utils/error/api-error.js";
import { API_ERROR } from "../../src/config/errors.js";

const logger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("../../src/utils/logger/logger.js", () => ({ default: { getLogger: () => logger } }));

describe("error handler", () => {
    it("does not log a thumbnail that is still being generated", async () => {
        const error = new ApiError({ message: "pending", status: 404, apiError: API_ERROR.ftpThumbnailPending });
        const app = express();
        app.get("/", () => {
            throw error;
        });
        app.use(Middlewares.errorHandler);
        const server = app.listen(0);
        logger.info.mockClear();
        logger.error.mockClear();
        try {
            const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
            expect(response.status).toBe(404);
            expect(await response.json()).toEqual({ code: error.code, message: "pending" });
            expect(logger.info).not.toHaveBeenCalled();
            expect(logger.error).not.toHaveBeenCalled();
        } finally {
            await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
        }
    });

    it("does not log transformed errors in the error handler", async () => {
        const cause = new ApiError({ message: "wrapped failure", status: 422, cause: new Error("internal failure") });
        const error = new ApiError({ message: "invalid media", status: 422, cause });
        const app = express();
        app.get("/", () => {
            throw error;
        });
        app.use(Middlewares.errorHandler);
        const server = app.listen(0);
        logger.info.mockClear();
        logger.error.mockClear();
        try {
            const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
            expect(response.status).toBe(422);
            expect(await response.json()).toEqual({ code: error.code, message: "invalid media" });
            expect(logger.error).not.toHaveBeenCalled();
            expect(logger.info).not.toHaveBeenCalled();
        } finally {
            await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
        }
    });

    it("does not log expected client errors", async () => {
        const cause = new ApiError({ message: "invalid media", status: 422 });
        const error = new ApiError({ message: "invalid media", status: 422, cause });
        const app = express();
        app.get("/", () => {
            throw error;
        });
        app.use(Middlewares.errorHandler);
        const server = app.listen(0);
        logger.info.mockClear();
        logger.error.mockClear();
        try {
            const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
            expect(response.status).toBe(422);
            expect(await response.json()).toEqual({ code: error.code, message: "invalid media" });
            expect(logger.info).not.toHaveBeenCalled();
            expect(logger.error).not.toHaveBeenCalled();
        } finally {
            await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
        }
    });

    it("logs unexpected causes once without exposing them in the response", async () => {
        logger.error.mockClear();
        const error = new Error("private detail");
        const app = express();
        app.get("/", () => {
            throw error;
        });
        app.use(Middlewares.errorHandler);
        const server = app.listen(0);
        try {
            const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
            expect(response.status).toBe(500);
            expect(await response.json()).toEqual({ code: API_ERROR.internalError, message: "Error inesperado" });
            expect(logger.error).toHaveBeenCalledOnce();
            expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ error }));
        } finally {
            await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
        }
    });
});

describe("authorization logging", () => {
    it("logs a denied role with the user and route template, without request data", async () => {
        const app = express();
        const router = express.Router();
        router.get(
            "/:id",
            (req, _res, next) => {
                req.user = { id: "user-id", roles: ["FTP"], iat: 1, exp: 2 };
                next();
            },
            Middlewares.authorizedRoles(["ADMIN"]),
            (_req, res) => res.sendStatus(200)
        );
        app.use("/users", router);
        app.use(Middlewares.errorHandler);
        const server = app.listen(0);
        logger.warn.mockClear();
        try {
            const response = await fetch(
                `http://127.0.0.1:${(server.address() as AddressInfo).port}/users/private-id?token=secret`
            );
            expect(response.status).toBe(403);
            expect(logger.warn).toHaveBeenCalledOnce();
            expect(logger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: "authorization.denied",
                    context: "User: user-id, method: GET, route: users > :id"
                })
            );
        } finally {
            await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
        }
    });

    it("does not log anonymous authentication failures", async () => {
        const app = express();
        app.get(
            "/",
            Middlewares.requireAuth({ accessTokenProvider: { create: vi.fn(), verify: vi.fn() } }),
            (_req, res) => res.sendStatus(200)
        );
        app.use(Middlewares.errorHandler);
        const server = app.listen(0);
        logger.warn.mockClear();
        try {
            const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
            expect(response.status).toBe(401);
            expect(logger.warn).not.toHaveBeenCalled();
        } finally {
            await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
        }
    });
});
