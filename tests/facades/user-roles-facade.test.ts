import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ITask } from "pg-promise";
import UserRolesFacade from "../../src/facades/impl/default-user-roles-facade.js";
import UserRolesService from "../../src/services/impl/default-user-roles-service.js";
import UserRolesMapper from "../../src/mappers/impl/default-user-roles-mapper.js";

const CLIENT_TX = {} as ITask<unknown>;
const createUserRolesServiceMock = () => ({ getByUsers: vi.fn(), createMany: vi.fn(), replace: vi.fn() });

describe("UserRolesFacade", () => {
    let userRolesService: ReturnType<typeof createUserRolesServiceMock>;
    let userRolesFacade: UserRolesFacade<ITask<unknown>>;

    beforeEach(() => {
        userRolesService = createUserRolesServiceMock();
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
            userRolesFacade.createMany({ clientTx: CLIENT_TX, userId: "user-1", roles: ["FTP"] })
        ).resolves.toEqual({ roles: ["FTP"] });
        expect(userRolesService.createMany).toHaveBeenCalledWith({ clientTx: CLIENT_TX, userRoles: source });
    });

    it("validates missing roles in the service before inserting", async () => {
        const model = { getByUsers: vi.fn(), insertMany: vi.fn(), deleteByUser: vi.fn() };
        const service = new UserRolesService({ userRolesModel: model });
        const facade = new UserRolesFacade({ userRolesService: service, userRolesMapper: UserRolesMapper });

        await expect(facade.createMany({ clientTx: CLIENT_TX, userId: "user-1" })).rejects.toMatchObject({
            code: "ACL_ROLE_REQUIRED"
        });
        expect(model.insertMany).not.toHaveBeenCalled();
    });

    it("should map domain roles before replacing them", async () => {
        const source = [{ user_id: "user-1", role: "ADMIN", scope: "FTP" }];
        userRolesService.replace.mockResolvedValue(source);

        await expect(
            userRolesFacade.replace({ clientTx: CLIENT_TX, userId: "user-1", roles: ["ADMIN"], scope: ["FTP"] })
        ).resolves.toEqual({ roles: ["ADMIN"], scope: ["FTP"] });
        expect(userRolesService.replace).toHaveBeenCalledWith({
            clientTx: CLIENT_TX,
            userId: "user-1",
            userRoles: source
        });
    });
});
