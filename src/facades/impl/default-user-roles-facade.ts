import type UserRolesFacade from "../user-roles-facade.js";
import type { UserRolesFacadeDependencies } from "../../types/default-user-roles-facade.js";
import type { UserAcl, UserAclByUser, UserRolesWriteParams } from "../../types/user-roles-facade.js";
import type { UsersByIdParams } from "../../types/user-roles-model.js";

/**
 * Default user roles facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultUserRolesFacade<Transaction> implements UserRolesFacade<Transaction> {
    constructor(private readonly dependencies: UserRolesFacadeDependencies<Transaction>) {}

    async getByUsers({ usersId }: UsersByIdParams) {
        return this.dependencies.userRolesMapper.rolesByUsersToDomain(
            await this.dependencies.userRolesService.getByUsers({ usersId })
        ) as UserAclByUser;
    }

    async createMany({ clientTx, userId, roles, scope }: UserRolesWriteParams<Transaction>) {
        const source = await this.dependencies.userRolesService.createMany({
            clientTx,
            userRoles: this.dependencies.userRolesMapper.rolesToPersistence({ userId, roles, scope })
        });
        return this.dependencies.userRolesMapper.rolesByUsersToDomain(source).get(userId) as UserAcl;
    }

    async replace({ clientTx, userId, roles, scope }: UserRolesWriteParams<Transaction>) {
        const source = await this.dependencies.userRolesService.replace({
            clientTx,
            userId,
            userRoles: this.dependencies.userRolesMapper.rolesToPersistence({ userId, roles, scope })
        });
        return this.dependencies.userRolesMapper.rolesByUsersToDomain(source).get(userId) as UserAcl;
    }
}
