import { describe, expect, it, beforeEach, vi } from "vitest";
import UsersController from "../../src/controllers/users-controller.js";

describe("UsersController validation", () => {
    let usersFacade;
    let controller;
    let req;
    let res;

    beforeEach(() => {
        usersFacade = { getAll: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
        controller = new UsersController({ usersFacade });
        req = {
            user: { id: "550e8400-e29b-41d4-a716-446655440000", roles: ["ADMIN"], scope: ["ADMIN"] },
            params: {},
            body: {}
        };
        res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    });

    describe("getAll", () => {
        it("should get all users", async () => {
            usersFacade.getAll.mockResolvedValue([]);
            await controller.getAll(req, res);
            expect(usersFacade.getAll).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith([]);
        });
    });

    describe("getById", () => {
        beforeEach(() => {
            req.params.id = "550e8400-e29b-41d4-a716-446655440000";
        });

        it("should get user by id", async () => {
            usersFacade.getById.mockResolvedValue({ id: req.params.id });
            await controller.getById(req, res);
            expect(usersFacade.getById).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalled();
        });

        it("should fail with invalid uuid", async () => {
            req.params.id = "BAD_ID";
            await expect(controller.getById(req, res)).rejects.toThrow();
        });
    });

    describe("create validation", () => {
        beforeEach(() => {
            req.body = { username: "test_user", password: "Password123!", active: true };
        });

        it("should create user", async () => {
            usersFacade.create.mockResolvedValue(true);
            await controller.create(req, res);
            expect(usersFacade.create).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(true);
        });

        it("should fail with invalid username type", async () => {
            req.body.username = 123;
            await expect(controller.create(req, res)).rejects.toThrow();
        });

        it("should fail with short username", async () => {
            req.body.username = "ab";
            await expect(controller.create(req, res)).rejects.toThrow();
        });

        it("should fail with invalid username format", async () => {
            req.body.username = "invalid user";
            await expect(controller.create(req, res)).rejects.toThrow();
        });

        it("should fail with short password", async () => {
            req.body.password = "123";
            await expect(controller.create(req, res)).rejects.toThrow();
        });

        it("should fail if admin role has no scope", async () => {
            req.body.roles = ["ADMIN"];
            await expect(controller.create(req, res)).rejects.toThrow();
        });

        it("should fail if non admin role defines scope", async () => {
            req.body.roles = ["FTP"];
            req.body.scope = ["FTP"];
            await expect(controller.create(req, res)).rejects.toThrow();
        });

        it("should validate admin role with scope", async () => {
            req.body.roles = ["ADMIN"];
            req.body.scope = ["FTP"];
            usersFacade.create.mockResolvedValue(true);
            await controller.create(req, res);
            expect(usersFacade.create).toHaveBeenCalled();
        });

        it("should fail with invalid role enum", async () => {
            req.body.roles = ["INVALID_ROLE"];
            await expect(controller.create(req, res)).rejects.toThrow();
        });
    });

    describe("update validation", () => {
        beforeEach(() => {
            req.body = { id: "550e8400-e29b-41d4-a716-446655440000" };
        });
        it("should update user", async () => {
            usersFacade.update.mockResolvedValue(true);
            await controller.update(req, res);
            expect(usersFacade.update).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(true);
        });

        it("should fail with invalid uuid", async () => {
            req.body.id = "BAD_ID";
            await expect(controller.update(req, res)).rejects.toThrow();
        });

        it("should fail if admin role has no scope", async () => {
            req.body.roles = ["ADMIN"];
            await expect(controller.update(req, res)).rejects.toThrow();
        });

        it("should fail if non admin role defines scope", async () => {
            req.body.roles = ["FTP"];
            req.body.scope = ["FTP"];
            await expect(controller.update(req, res)).rejects.toThrow();
        });

        it("should validate admin role with scope", async () => {
            req.body.roles = ["ADMIN"];
            req.body.scope = ["FTP"];
            usersFacade.update.mockResolvedValue(true);
            await controller.update(req, res);
            expect(usersFacade.update).toHaveBeenCalled();
        });

        it("should fail with invalid role enum", async () => {
            req.body.roles = ["INVALID_ROLE"];
            await expect(controller.update(req, res)).rejects.toThrow();
        });
    });

    describe("delete validation", () => {
        beforeEach(() => {
            req.params.id = "550e8400-e29b-41d4-a716-446655440000";
        });

        it("should delete user", async () => {
            usersFacade.delete.mockResolvedValue(true);
            await controller.delete(req, res);
            expect(usersFacade.delete).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(true);
        });

        it("should fail with invalid uuid", async () => {
            req.params.id = "BAD_ID";
            await expect(controller.delete(req, res)).rejects.toThrow();
        });
    });
});
