import { beforeEach, describe, expect, it, vi } from "vitest";
import UsersService from "../../services/users-service.js";

describe("UsersService", () => {
    let usersModel;
    let usersService;

    beforeEach(() => {
        usersModel = {
            getAll: vi.fn(),
            getById: vi.fn(),
            authenticate: vi.fn(),
            insert: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        };
        usersService = new UsersService({ usersModel });
    });

    describe("getAll", () => {
        it("should return all users", async () => {
            const users = [{ id: "1", username: "user" }];
            usersModel.getAll.mockResolvedValue(users);
            const result = await usersService.getAll();
            expect(result).toEqual(users);
        });
    });

    describe("getById", () => {
        it("should return user", async () => {
            usersModel.getById.mockResolvedValue({ id: "1", username: "test" });
            const result = await usersService.getById({ id: "1" });
            expect(result.id).toBe("1");
        });

        it("should fail if user does not exist", async () => {
            usersModel.getById.mockResolvedValue(null);
            await expect(usersService.getById({ id: "1" })).rejects.toThrow("El usuario no existe");
        });
    });

    describe("authenticate", () => {
        it("should authenticate user", async () => {
            usersModel.authenticate.mockResolvedValue({ id: "1", username: "admin", active: true });
            const result = await usersService.authenticate({ username: "admin", password: "1234" });
            expect(result.username).toBe("admin");
        });

        it("should fail with invalid credentials", async () => {
            usersModel.authenticate.mockResolvedValue(null);
            await expect(usersService.authenticate({ username: "admin", password: "bad" })).rejects.toThrow(
                "Usuario o contraseña incorrectos"
            );
        });

        it("should fail if user is inactive", async () => {
            usersModel.authenticate.mockResolvedValue({ id: "1", username: "admin", active: false });
            await expect(usersService.authenticate({ username: "admin", password: "1234" })).rejects.toThrow(
                "Usuario o contraseña incorrectos"
            );
        });
    });

    describe("create", () => {
        it("should create user", async () => {
            usersModel.insert.mockResolvedValue({ id: "1", username: "user" });
            const result = await usersService.create({ clientTx: {}, user: { username: "user" } });
            expect(result).toEqual({ id: "1", username: "user" });
            expect(usersModel.insert).toHaveBeenCalledWith({ clientTx: {}, user: { username: "user" } });
        });

        it("should fail if username already exists", async () => {
            usersModel.insert.mockRejectedValue({ code: "23505" });
            await expect(usersService.create({ clientTx: {}, user: { username: "user" } })).rejects.toThrow(
                "El nombre de usuario ya está en uso"
            );
        });
    });

    describe("update", () => {
        it("should update user", async () => {
            usersModel.update.mockResolvedValue({ id: "1", username: "updated" });
            const result = await usersService.update({ clientTx: {}, id: "1", data: { username: "updated" } });
            expect(result).toEqual({ id: "1", username: "updated" });
            expect(usersModel.update).toHaveBeenCalledWith({ clientTx: {}, id: "1", data: { username: "updated" } });
        });

        it("should fail if username already exists", async () => {
            usersModel.update.mockRejectedValue({ code: "23505" });
            await expect(usersService.update({ clientTx: {}, id: "1", data: { username: "updated" } })).rejects.toThrow(
                "El nombre de usuario ya está en uso"
            );
        });

        it("should fail when update data is empty", async () => {
            await expect(usersService.update({ clientTx: {}, id: "1", data: {} })).rejects.toMatchObject({
                code: "USER_EMPTY_UPDATE",
                status: 400
            });
            expect(usersModel.update).not.toHaveBeenCalled();
        });
    });

    describe("delete", () => {
        it("should delete user", async () => {
            usersModel.delete.mockResolvedValue({ id: "1" });
            const result = await usersService.delete({ id: "1" });
            expect(result).toEqual({ id: "1" });
            expect(usersModel.delete).toHaveBeenCalledWith({ id: "1" });
        });
    });
});
