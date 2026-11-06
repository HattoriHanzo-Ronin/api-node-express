import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ITask } from "pg-promise";
import UserRolesService from "../../src/services/impl/default-user-roles-service.js";

const CLIENT_TX = {} as ITask<unknown>;
const createUserRolesModelMock = () => ({ getByUsers: vi.fn(), insertMany: vi.fn(), deleteByUser: vi.fn() });

describe("UserRolesService", () => {
    let userRolesModel: ReturnType<typeof createUserRolesModelMock>;
    let userRolesService: UserRolesService<ITask<unknown>>;

    beforeEach(() => {
        userRolesModel = createUserRolesModelMock();
        userRolesService = new UserRolesService({ userRolesModel });
    });

    describe("getByUsers", () => {
        it("should return user roles", async () => {
            const roles = [
                { user_id: "1", role: "FTP" },
                { user_id: "2", role: "DEVICE" }
            ];
            userRolesModel.getByUsers.mockResolvedValue(roles);
            const result = await userRolesService.getByUsers({ usersId: ["1", "2"] });
            expect(result).toEqual(roles);
            expect(userRolesModel.getByUsers).toHaveBeenCalledWith({ usersId: ["1", "2"] });
        });
    });

    describe("createMany", () => {
        it("should create user roles", async () => {
            const createdRoles = [{ user_id: "1", role: "FTP" as const, scope: null }];
            userRolesModel.insertMany.mockResolvedValue(createdRoles);
            const result = await userRolesService.createMany({ clientTx: CLIENT_TX, userRoles: createdRoles });
            expect(result).toEqual(createdRoles);
            expect(userRolesModel.insertMany).toHaveBeenCalledWith({ clientTx: CLIENT_TX, userRoles: createdRoles });
        });

        it("should create persistence role assignments", async () => {
            const userRoles = [{ user_id: "1", role: "ADMIN" as const, scope: "FTP,NET" }];
            userRolesModel.insertMany.mockResolvedValue([]);
            await userRolesService.createMany({ clientTx: CLIENT_TX, userRoles });
            expect(userRolesModel.insertMany).toHaveBeenCalledWith({
                clientTx: CLIENT_TX,
                userRoles
            });
        });

        it("should fail if roles are not defined", async () => {
            await expect(userRolesService.createMany({ clientTx: CLIENT_TX, userRoles: undefined as never })).rejects.toThrow(
                "Se debe especificar al menos un rol para el usuario"
            );
        });

        it("should translate model errors even when they have the required-role code", async () => {
            userRolesModel.insertMany.mockRejectedValue({ code: "ACL_ROLE_REQUIRED" });
            await expect(userRolesService.createMany({ clientTx: CLIENT_TX, userRoles: [] })).rejects.toMatchObject({
                code: "ACL_ROLE_CREATE_FAILED"
            });
        });
    });

    describe("replace", () => {
        it("should replace user roles", async () => {
            const createdRoles = [{ user_id: "1", role: "FTP" as const, scope: null }];
            userRolesModel.insertMany.mockResolvedValue(createdRoles);
            const result = await userRolesService.replace({ clientTx: CLIENT_TX, userId: "1", userRoles: createdRoles });
            expect(userRolesModel.deleteByUser).toHaveBeenCalledWith({ clientTx: CLIENT_TX, userId: "1" });
            expect(result).toEqual(createdRoles);
        });

        it("should translate non-API model errors", async () => {
            userRolesModel.deleteByUser.mockRejectedValue(null);
            await expect(userRolesService.replace({ clientTx: CLIENT_TX, userId: "1", userRoles: [] })).rejects.toMatchObject({
                code: "ACL_ROLE_UPDATE_FAILED"
            });
        });
    });
});
