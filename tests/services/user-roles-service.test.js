import { beforeEach, describe, expect, it, vi } from "vitest";
import UserRolesService from "../../src/services/user-roles-service.js";

describe("UserRolesService", () => {
    let userRolesModel;
    let userRolesService;

    beforeEach(() => {
        userRolesModel = { getByUsers: vi.fn(), insertMany: vi.fn(), deleteByUser: vi.fn() };
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
            const createdRoles = [{ user_id: "1", role: "FTP", scope: null }];
            userRolesModel.insertMany.mockResolvedValue(createdRoles);
            const result = await userRolesService.createMany({ clientTx: {}, userId: "1", roles: ["FTP"] });
            expect(result).toEqual(createdRoles);
            expect(userRolesModel.insertMany).toHaveBeenCalledWith({ clientTx: {}, userRoles: createdRoles });
        });

        it("should create admin role with scope", async () => {
            userRolesModel.insertMany.mockResolvedValue([]);
            await userRolesService.createMany({ clientTx: {}, userId: "1", roles: ["ADMIN"], scope: ["FTP", "NET"] });
            expect(userRolesModel.insertMany).toHaveBeenCalledWith({
                clientTx: {},
                userRoles: [{ user_id: "1", role: "ADMIN", scope: "FTP,NET" }]
            });
        });

        it("should fail if roles are not defined", async () => {
            await expect(userRolesService.createMany({ clientTx: {}, userId: "1" })).rejects.toThrow(
                "Se debe especificar al menos un rol para el usuario"
            );
        });
    });

    describe("replace", () => {
        it("should replace user roles", async () => {
            const createdRoles = [{ user_id: "1", role: "FTP", scope: null }];
            userRolesModel.insertMany.mockResolvedValue(createdRoles);
            const result = await userRolesService.replace({ clientTx: {}, userId: "1", roles: ["FTP"] });
            expect(userRolesModel.deleteByUser).toHaveBeenCalledWith({ clientTx: {}, userId: "1" });
            expect(result).toEqual(createdRoles);
        });
    });
});
