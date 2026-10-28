import { beforeEach, describe, expect, it, vi } from "vitest";
import UserRolesFacade from "../../src/facades/user-roles-facade.js";
import UserRolesMapper from "../../src/mappers/user-roles-mapper.js";

describe("UserRolesFacade", () => {
    let userRolesService;
    let userRolesFacade;

    beforeEach(() => {
        userRolesService = { getByUsers: vi.fn(), createMany: vi.fn(), replace: vi.fn() };
        userRolesFacade = new UserRolesFacade({ userRolesService, userRolesMapper: UserRolesMapper });
    });

    it("should return ACL data by user", async () => {
        userRolesService.getByUsers.mockResolvedValue([
            { user_id: "user-1", role: "FTP", scope: null },
            { user_id: "user-1", role: "ADMIN", scope: "FTP,NET" }
        ]);

        await expect(userRolesFacade.getByUsers({ usersId: ["user-1"] })).resolves.toEqual(
            new Map([["user-1", { roles: ["FTP", "ADMIN"], scope: ["FTP", "NET"] }]])
        );
    });

    it("should map domain roles before creating them", async () => {
        const source = [{ user_id: "user-1", role: "FTP", scope: null }];
        userRolesService.createMany.mockResolvedValue(source);

        await expect(
            userRolesFacade.createMany({ clientTx: {}, userId: "user-1", roles: ["FTP"], scope: undefined })
        ).resolves.toEqual({ roles: ["FTP"] });
        expect(userRolesService.createMany).toHaveBeenCalledWith({ clientTx: {}, userRoles: source });
    });

    it("should map domain roles before replacing them", async () => {
        const source = [{ user_id: "user-1", role: "ADMIN", scope: "FTP" }];
        userRolesService.replace.mockResolvedValue(source);

        await expect(
            userRolesFacade.replace({ clientTx: {}, userId: "user-1", roles: ["ADMIN"], scope: ["FTP"] })
        ).resolves.toEqual({ roles: ["ADMIN"], scope: ["FTP"] });
        expect(userRolesService.replace).toHaveBeenCalledWith({ clientTx: {}, userId: "user-1", userRoles: source });
    });
});
