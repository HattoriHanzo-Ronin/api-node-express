import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ITask } from "pg-promise";
import UsersFacade from "../../src/facades/impl/default-users-facade.js";
import type { UsersFacadeDependencies } from "../../src/types/users/default-users-facade.js";
import type { VerifiedAccessToken } from "../../src/types/auth/auth-facade.js";

const CLIENT_TX = {} as ITask<unknown>;
const ADMIN_FTP: VerifiedAccessToken = {
    iat: 1_800_000_000,
    exp: 1_900_000_000,
    id: "1",
    roles: ["ADMIN"],
    scope: ["FTP"]
};
const createUsersServiceMock = () => ({
    getAll: vi.fn(),
    getById: vi.fn(),
    authenticate: vi.fn(),
    checkPassword: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
});
const createDataVersionsFacadeMock = () => ({ getById: vi.fn().mockResolvedValue({ version: "4" }) });
const createUserRolesFacadeMock = () => ({
    getByUsers: vi.fn().mockResolvedValue(new Map()),
    createMany: vi.fn(),
    replace: vi.fn()
});
const createUsersMapperMock = () => ({ userToDomain: vi.fn(), usersToDomain: vi.fn() });
const createSocketSessionsFacadeMock = () => ({ notify: vi.fn() });

describe("UsersFacade", () => {
    let usersService: ReturnType<typeof createUsersServiceMock>;
    let dataVersionsFacade: ReturnType<typeof createDataVersionsFacadeMock>;
    let userRolesFacade: ReturnType<typeof createUserRolesFacadeMock>;
    let usersMapper: ReturnType<typeof createUsersMapperMock>;
    let socketSessionsFacade: ReturnType<typeof createSocketSessionsFacadeMock>;
    let usersFacade: UsersFacade<ITask<unknown>>;

    beforeEach(() => {
        usersService = createUsersServiceMock();
        dataVersionsFacade = createDataVersionsFacadeMock();
        userRolesFacade = createUserRolesFacadeMock();
        usersMapper = createUsersMapperMock();
        socketSessionsFacade = createSocketSessionsFacadeMock();
        usersFacade = new UsersFacade({
            usersService,
            dataVersionsFacade: dataVersionsFacade as unknown as UsersFacadeDependencies<
                ITask<unknown>
            >["dataVersionsFacade"],
            userRolesFacade: userRolesFacade as unknown as UsersFacadeDependencies<ITask<unknown>>["userRolesFacade"],
            usersMapper,
            socketSessionsFacade: socketSessionsFacade as unknown as UsersFacadeDependencies<
                ITask<unknown>
            >["socketSessionsFacade"],
            tx: async (cb) => cb(CLIENT_TX)
        });
    });

    describe("getAll", () => {
        it("should return accessible users with their data version", async () => {
            const users = [{ id: "1", username: "user" }];
            usersService.getAll.mockResolvedValue(users);
            usersMapper.usersToDomain.mockReturnValue([{ id: "1", username: "user", roles: ["FTP"] }]);

            await expect(usersFacade.getAll({ authUser: ADMIN_FTP })).resolves.toEqual({
                version: "4",
                data: [{ id: "1", username: "user" }]
            });
            expect(dataVersionsFacade.getById).toHaveBeenCalledWith({ id: "users" });
            expect(usersMapper.usersToDomain).toHaveBeenCalledWith({ users, aclByUser: new Map() });
        });
    });

    describe("getById", () => {
        it("should retain ACL data when no authenticated user is supplied", async () => {
            usersService.getById.mockResolvedValue({ id: "1", username: "user" });
            usersMapper.userToDomain.mockReturnValue({ id: "1", username: "user", roles: ["FTP"] });
            await expect(usersFacade.getById({ id: "1" })).resolves.toEqual({
                id: "1",
                username: "user",
                roles: ["FTP"]
            });
        });

        it("should return user", async () => {
            usersService.getById.mockResolvedValue({ id: "1", username: "user" });
            usersMapper.userToDomain.mockReturnValue({ id: "1", username: "user", roles: ["FTP"] });
            const result = await usersFacade.getById({ authUser: ADMIN_FTP, id: "1" });
            expect(result.username).toBe("user");
        });

        it("should fail if user is outside managed scope", async () => {
            usersService.getById.mockResolvedValue({ id: "1", username: "user" });
            usersMapper.userToDomain.mockReturnValue({ id: "1", username: "user", roles: ["NET"] });
            await expect(usersFacade.getById({ authUser: ADMIN_FTP, id: "1" })).rejects.toThrow("El usuario no existe");
        });
    });

    describe("authenticate", () => {
        it("should authenticate user", async () => {
            usersService.authenticate.mockResolvedValue({ id: "1" });
            userRolesFacade.getByUsers.mockResolvedValue(new Map([["1", { roles: ["ADMIN"] }]]));
            usersMapper.userToDomain.mockReturnValue({ id: "1", username: "admin", roles: ["ADMIN"] });
            const result = await usersFacade.authenticate({ username: "admin", password: "1234" });
            expect(result.username).toBe("admin");
            expect(usersMapper.userToDomain).toHaveBeenCalledWith({
                source: { id: "1", username: "admin" },
                acl: { roles: ["ADMIN"] }
            });
        });
    });

    describe("create", () => {
        it("should create user as super admin", async () => {
            usersService.create.mockResolvedValue({ id: "1", username: "user" });
            userRolesFacade.createMany.mockResolvedValue({ roles: ["FTP"] });
            usersMapper.userToDomain.mockReturnValue({ id: "1", username: "user", roles: ["FTP"] });
            const result = await usersFacade.create({
                authUser: { iat: 1_800_000_000, exp: 1_900_000_000, id: "1", roles: ["ADMIN"], scope: ["ADMIN"] },
                user: { username: "user", password: "Password123!", active: true, roles: ["FTP"] }
            });
            expect(result.id).toBe("1");
            expect(userRolesFacade.createMany).toHaveBeenCalled();
        });

        it("should fail when non super admin sends roles", async () => {
            await expect(
                usersFacade.create({
                    authUser: ADMIN_FTP,
                    user: { username: "user", password: "Password123!", active: true, roles: ["NET"] }
                })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should inherit admin scope when creating a user", async () => {
            usersService.create.mockResolvedValue({ id: "1", username: "user" });
            userRolesFacade.createMany.mockResolvedValue({ roles: ["FTP"] });
            usersMapper.userToDomain.mockReturnValue({ id: "1", username: "user" });
            await usersFacade.create({
                authUser: ADMIN_FTP,
                user: { username: "user", password: "Password123!", active: true }
            });
            expect(userRolesFacade.createMany).toHaveBeenCalledWith({
                clientTx: expect.anything(),
                userId: "1",
                roles: ["FTP"],
                scope: undefined
            });
            expect(socketSessionsFacade.notify).toHaveBeenCalledWith({ entity: "users", data: { version: "4" } });
        });
    });

    describe("update", () => {
        beforeEach(() => {
            usersService.update.mockResolvedValue({ id: "1", username: "updated" });
            usersService.getById.mockResolvedValue({ id: "1", username: "user" });
        });

        it("should allow user to update himself", async () => {
            const result = await usersFacade.update({
                authUser: { iat: 1_800_000_000, exp: 1_900_000_000, id: "1", roles: ["FTP"], scope: ["FTP"] },
                data: { id: "1", username: "updated" }
            });
            expect(result).toEqual({ username: "updated" });
        });

        it("should fail when user updates another user", async () => {
            await expect(
                usersFacade.update({
                    authUser: { iat: 1_800_000_000, exp: 1_900_000_000, id: "1", roles: ["FTP"], scope: ["FTP"] },
                    data: { id: "2", username: "updated" }
                })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should fail when user updates roles", async () => {
            await expect(
                usersFacade.update({
                    authUser: { iat: 1_800_000_000, exp: 1_900_000_000, id: "1", roles: ["FTP"], scope: ["FTP"] },
                    data: { id: "1", roles: ["ADMIN"] }
                })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should require a password challenge when a user changes his own password", async () => {
            await expect(
                usersFacade.update({
                    authUser: { iat: 1_800_000_000, exp: 1_900_000_000, id: "1", roles: ["FTP"], scope: ["FTP"] },
                    data: { id: "1", password: "NewPassword123!" }
                })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should allow an admin to change another user's password", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["FTP"], scope: [] });
            await expect(
                usersFacade.update({
                    authUser: { iat: 1_800_000_000, exp: 1_900_000_000, id: "1", roles: ["ADMIN"], scope: ["FTP"] },
                    data: { id: "2", password: "NewPassword123!" }
                })
            ).resolves.toEqual({ id: "1", username: "updated" });
        });

        it("should fail when admin deactivates himself", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["ADMIN"], scope: ["FTP"] });
            await expect(
                usersFacade.update({
                    authUser: { iat: 1_800_000_000, exp: 1_900_000_000, id: "1", roles: ["ADMIN"], scope: ["FTP"] },
                    data: { id: "1", active: false }
                })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should fail when admin updates user outside managed scope", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["NET"] });
            await expect(
                usersFacade.update({
                    authUser: { iat: 1_800_000_000, exp: 1_900_000_000, id: "1", roles: ["ADMIN"], scope: ["FTP"] },
                    data: { id: "2", username: "updated" }
                })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should allow super admin to update roles", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["ADMIN"], scope: ["ADMIN"] });
            userRolesFacade.replace.mockResolvedValue({ roles: ["FTP"] });
            const result = await usersFacade.update({
                authUser: { iat: 1_800_000_000, exp: 1_900_000_000, id: "1", roles: ["ADMIN"], scope: ["ADMIN"] },
                data: { id: "2", roles: ["FTP"] }
            });
            expect(userRolesFacade.replace).toHaveBeenCalled();
            expect(result).toBeDefined();
        });

        it("should fail when super admin removes his own admin role", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["ADMIN"], scope: ["ADMIN"] });
            await expect(
                usersFacade.update({
                    authUser: { iat: 1_800_000_000, exp: 1_900_000_000, id: "1", roles: ["ADMIN"], scope: ["ADMIN"] },
                    data: { id: "1", roles: ["FTP"] }
                })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should fail when super admin removes ADMIN from his scope", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["ADMIN"], scope: ["ADMIN", "FTP"] });
            await expect(
                usersFacade.update({
                    authUser: { iat: 1_800_000_000, exp: 1_900_000_000, id: "1", roles: ["ADMIN"], scope: ["ADMIN"] },
                    data: { id: "1", scope: ["FTP"] }
                })
            ).rejects.toThrow("No tiene permisos para realizar esa acción");
        });

        it("should not replace roles when acl is not modified", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["ADMIN"], scope: ["ADMIN"] });
            await usersFacade.update({
                authUser: { iat: 1_800_000_000, exp: 1_900_000_000, id: "1", roles: ["ADMIN"], scope: ["ADMIN"] },
                data: { id: "2", username: "updated" }
            });
            expect(userRolesFacade.replace).not.toHaveBeenCalled();
        });

        it("should replace roles when acl is modified", async () => {
            usersMapper.userToDomain.mockReturnValue({ roles: ["ADMIN"], scope: ["ADMIN"] });
            userRolesFacade.replace.mockResolvedValue({ roles: ["FTP"] });
            await usersFacade.update({
                authUser: { iat: 1_800_000_000, exp: 1_900_000_000, id: "1", roles: ["ADMIN"], scope: ["ADMIN"] },
                data: { id: "2", roles: ["FTP"] }
            });
            expect(userRolesFacade.replace).toHaveBeenCalled();
        });
    });

    describe("changePassword", () => {
        it("should check current password and update it", async () => {
            const authUser: VerifiedAccessToken = {
                iat: 1_800_000_000,
                exp: 1_900_000_000,
                id: "1",
                roles: ["FTP"],
                scope: ["FTP"]
            };
            usersService.checkPassword.mockResolvedValue(undefined);
            vi.spyOn(usersFacade, "update").mockResolvedValue({ username: "user" });

            await expect(
                usersFacade.changePassword({
                    authUser,
                    currentPassword: "Password123!",
                    newPassword: "NewPassword123!"
                })
            ).resolves.toBeUndefined();
            expect(usersService.checkPassword).toHaveBeenCalledWith({ id: "1", password: "Password123!" });
            expect(usersFacade.update).toHaveBeenCalledWith({
                authUser,
                data: { id: "1", password: "NewPassword123!" },
                changePassword: true
            });
        });

        it("should not update when current password is incorrect", async () => {
            usersService.checkPassword.mockRejectedValue(new Error("Contraseña incorrecta"));
            const update = vi.spyOn(usersFacade, "update");

            await expect(
                usersFacade.changePassword({
                    authUser: { iat: 1_800_000_000, exp: 1_900_000_000, id: "1", roles: ["FTP"] },
                    currentPassword: "WrongPassword1!",
                    newPassword: "NewPassword123!"
                })
            ).rejects.toThrow("Contraseña incorrecta");
            expect(update).not.toHaveBeenCalled();
        });
    });

    describe("delete", () => {
        it("should delete user", async () => {
            vi.spyOn(usersFacade, "getById").mockResolvedValue({
                id: "1",
                username: "user",
                active: true,
                created_at: new Date("2024-01-01T00:00:00Z"),
                updated_at: new Date("2024-01-01T00:00:00Z")
            });
            usersService.delete.mockResolvedValue({ id: "1" });
            const result = await usersFacade.delete({ authUser: ADMIN_FTP, id: "1" });
            expect(result).toEqual({ id: "1" });
            expect(usersService.delete).toHaveBeenCalledWith({ id: "1" });
        });
    });
});
