import { beforeEach, describe, expect, it, vi } from "vitest";
import UsersFacade from "../../src/facades/users-facade.js";

describe("UsersFacade", () => {
    let usersService;
    let dataVersionsService;
    let userRolesService;
    let usersMapper;
    let usersFacade;

    beforeEach(() => {
        usersService = {
            getAll: vi.fn(),
            getById: vi.fn(),
            authenticate: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        };
        dataVersionsService = { getById: vi.fn().mockResolvedValue({ version: "4" }) };
        userRolesService = { getByUsers: vi.fn(), createMany: vi.fn(), replace: vi.fn() };
        usersMapper = { userToDomain: vi.fn(), usersToDomain: vi.fn() };
        usersFacade = new UsersFacade({ usersService, dataVersionsService, userRolesService, usersMapper, tx: async (cb) => cb({}) });
    });

    describe("getAll", () => {
        it("should return accessible users with their data version", async () => {
            const users = [{ id: "1", username: "user" }];
            usersService.getAll.mockResolvedValue(users);
            userRolesService.getByUsers.mockResolvedValue([]);
            usersMapper.usersToDomain.mockReturnValue([{ id: "1", username: "user", roles: ["FTP"] }]);

            await expect(usersFacade.getAll({ authUser: { scope: ["FTP"] } })).resolves.toEqual({
                version: "4",
                data: [{ id: "1", username: "user" }]
            });
            expect(dataVersionsService.getById).toHaveBeenCalledWith({ id: "users" });
            expect(usersMapper.usersToDomain).toHaveBeenCalledWith({ users, roles: [] });
        });
    });

    describe("getById", () => {
        it("should return user", async () => {
            usersService.getById.mockResolvedValue({ id: "1", username: "user" });
            userRolesService.getByUsers.mockResolvedValue([]);
            usersMapper.userToDomain.mockReturnValue({ id: "1", username: "user", roles: ["FTP"] });
            const result = await usersFacade.getById({ authUser: { scope: ["FTP"] }, id: "1" });
            expect(result.username).toBe("user");
        });

        it("should fail if user is outside managed scope", async () => {
            usersService.getById.mockResolvedValue({ id: "1", username: "user" });
            userRolesService.getByUsers.mockResolvedValue([]);
            usersMapper.userToDomain.mockReturnValue({ id: "1", username: "user", roles: ["NET"] });
            await expect(usersFacade.getById({ authUser: { scope: ["FTP"] }, id: "1" })).rejects.toThrow(
                "El usuario no existe"
            );
        });
    });

    describe("authenticate", () => {
        it("should authenticate user", async () => {
            usersService.authenticate.mockResolvedValue({ id: "1" });
            userRolesService.getByUsers.mockResolvedValue([]);
            usersMapper.userToDomain.mockReturnValue({ id: "1", username: "admin", roles: ["ADMIN"] });
            const result = await usersFacade.authenticate({ username: "admin", password: "1234" });
            expect(result.username).toBe("admin");
        });
    });

    describe("create", () => {
        it("should create user as super admin", async () => {
            usersService.create.mockResolvedValue({ id: "1", username: "user" });
            userRolesService.createMany.mockResolvedValue([]);
            usersMapper.userToDomain.mockReturnValue({ id: "1", username: "user", roles: ["FTP"] });
            const result = await usersFacade.create({
                authUser: { scope: ["ADMIN"] },
                user: { username: "user", roles: ["FTP"] }
            });
            expect(result.id).toBe("1");
            expect(userRolesService.createMany).toHaveBeenCalled();
        });

        it("should fail when non super admin sends roles", async () => {
            await expect(
                usersFacade.create({ authUser: { scope: ["FTP"] }, user: { username: "user", roles: ["NET"] } })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should inherit admin scope when creating a user", async () => {
            usersService.create.mockResolvedValue({ id: "1", username: "user" });
            userRolesService.createMany.mockResolvedValue([]);
            usersMapper.userToDomain.mockReturnValue({ id: "1", username: "user" });
            await usersFacade.create({ authUser: { scope: ["FTP"] }, user: { username: "user" } });
            expect(userRolesService.createMany).toHaveBeenCalledWith({
                clientTx: expect.anything(),
                userId: "1",
                roles: ["FTP"],
                scope: undefined
            });
        });
    });

    describe("update", () => {
        beforeEach(() => {
            usersService.update.mockResolvedValue({ id: "1", username: "updated" });
            usersService.getById.mockResolvedValue({ id: "1", username: "user" });
            userRolesService.getByUsers.mockResolvedValue([]);
        });

        it("should allow user to update himself", async () => {
            const result = await usersFacade.update({
                authUser: { id: "1", roles: ["FTP"], scope: ["FTP"] },
                data: { id: "1", username: "updated" }
            });
            expect(result).toEqual({ username: "updated" });
        });

        it("should fail when user updates another user", async () => {
            await expect(
                usersFacade.update({
                    authUser: { id: "1", roles: ["FTP"], scope: ["FTP"] },
                    data: { id: "2", username: "updated" }
                })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should fail when user updates roles", async () => {
            await expect(
                usersFacade.update({
                    authUser: { id: "1", roles: ["FTP"], scope: ["FTP"] },
                    data: { id: "1", roles: ["ADMIN"] }
                })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should fail when admin deactivates himself", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["ADMIN"], scope: ["FTP"] });
            await expect(
                usersFacade.update({
                    authUser: { id: "1", roles: ["ADMIN"], scope: ["FTP"] },
                    data: { id: "1", active: false }
                })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should fail when admin updates user outside managed scope", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["NET"] });
            await expect(
                usersFacade.update({
                    authUser: { id: "1", roles: ["ADMIN"], scope: ["FTP"] },
                    data: { id: "2", username: "updated" }
                })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should allow super admin to update roles", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["ADMIN"], scope: ["ADMIN"] });
            userRolesService.replace.mockResolvedValue([]);
            const result = await usersFacade.update({
                authUser: { id: "1", roles: ["ADMIN"], scope: ["ADMIN"] },
                data: { id: "2", roles: ["FTP"] }
            });
            expect(userRolesService.replace).toHaveBeenCalled();
            expect(result).toBeDefined();
        });

        it("should fail when super admin removes his own admin role", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["ADMIN"], scope: ["ADMIN"] });
            await expect(
                usersFacade.update({
                    authUser: { id: "1", roles: ["ADMIN"], scope: ["ADMIN"] },
                    data: { id: "1", roles: ["FTP"] }
                })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should fail when super admin removes ADMIN from his scope", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["ADMIN"], scope: ["ADMIN", "FTP"] });
            await expect(
                usersFacade.update({
                    authUser: { id: "1", roles: ["ADMIN"], scope: ["ADMIN"] },
                    data: { id: "1", scope: ["FTP"] }
                })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should not replace roles when acl is not modified", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["ADMIN"], scope: ["ADMIN"] });
            await usersFacade.update({
                authUser: { id: "1", roles: ["ADMIN"], scope: ["ADMIN"] },
                data: { id: "2", username: "updated" }
            });
            expect(userRolesService.replace).not.toHaveBeenCalled();
        });

        it("should replace roles when acl is modified", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["ADMIN"], scope: ["ADMIN"] });
            userRolesService.replace.mockResolvedValue([]);
            await usersFacade.update({
                authUser: { id: "1", roles: ["ADMIN"], scope: ["ADMIN"] },
                data: { id: "2", roles: ["FTP"] }
            });
            expect(userRolesService.replace).toHaveBeenCalled();
        });
    });

    describe("delete", () => {
        it("should delete user", async () => {
            vi.spyOn(usersFacade, "getById").mockResolvedValue({ id: "1" });
            usersService.delete.mockResolvedValue({ id: "1" });
            const result = await usersFacade.delete({ authUser: { scope: ["FTP"] }, id: "1" });
            expect(result).toEqual({ id: "1" });
            expect(usersService.delete).toHaveBeenCalledWith({ id: "1" });
        });
    });
});
