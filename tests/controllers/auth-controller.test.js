import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthController from "../../src/controllers/auth-controller.js";

describe("AuthController", () => {
    let authFacade;
    let controller;
    let req;
    let res;

    beforeEach(() => {
        authFacade = { login: vi.fn(), refresh: vi.fn(), logout: vi.fn() };
        controller = new AuthController({ authFacade });
        req = { body: {} };
        res = { json: vi.fn(), status: vi.fn().mockReturnThis(), end: vi.fn() };
    });

    describe("login", () => {
        it("should authenticate a user", async () => {
            req.body = { username: "admin", password: "password12!!" };
            authFacade.login.mockResolvedValue({ accessToken: "token" });
            await controller.login(req, res);
            expect(authFacade.login).toHaveBeenCalledWith({ username: "admin", password: "password12!!" });
            expect(res.json).toHaveBeenCalledWith({ accessToken: "token" });
        });

        it("should fail if username is missing", async () => {
            req.body = { password: "password" };
            await expect(controller.login(req, res)).rejects.toThrow();
        });

        it("should fail if password is missing", async () => {
            req.body = { username: "admin" };
            await expect(controller.login(req, res)).rejects.toThrow();
        });

        it("should fail if username is empty", async () => {
            req.body = { username: "", password: "password" };
            await expect(controller.login(req, res)).rejects.toThrow();
        });

        it("should fail if password is empty", async () => {
            req.body = { username: "admin", password: "" };
            await expect(controller.login(req, res)).rejects.toThrow();
        });
    });

    describe("refresh", () => {
        it("should refresh a session", async () => {
            req.body = { refreshToken: "refresh-token" };
            authFacade.refresh.mockResolvedValue({ accessToken: "new-token" });
            await controller.refresh(req, res);
            expect(authFacade.refresh).toHaveBeenCalledWith({ refreshToken: "refresh-token" });
            expect(res.json).toHaveBeenCalledWith({ accessToken: "new-token" });
        });

        it("should fail if refresh token is missing", async () => {
            await expect(controller.refresh(req, res)).rejects.toThrow();
        });

        it("should fail if refresh token is empty", async () => {
            req.body = { refreshToken: "" };
            await expect(controller.refresh(req, res)).rejects.toThrow();
        });
    });

    describe("logout", () => {
        it("should logout a user", async () => {
            req.body = { refreshToken: "refresh-token" };
            await controller.logout(req, res);
            expect(authFacade.logout).toHaveBeenCalledWith({ refreshToken: "refresh-token" });
            expect(res.status).toHaveBeenCalledWith(204);
            expect(res.end).toHaveBeenCalled();
        });

        it("should fail if refresh token is missing", async () => {
            await expect(controller.logout(req, res)).rejects.toThrow();
        });

        it("should fail if refresh token is empty", async () => {
            req.body = { refreshToken: "" };
            await expect(controller.logout(req, res)).rejects.toThrow();
        });
    });
});
