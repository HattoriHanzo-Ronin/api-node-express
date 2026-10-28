/**
 * User roles facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class UserRolesFacade {
    constructor({ userRolesService, userRolesMapper }) {
        this.userRolesService = userRolesService;
        this.userRolesMapper = userRolesMapper;
    }

    /**
     * Returns user ACL data indexed by user identifier
     *
     * @param {string[]} params.usersId User identifiers
     * @returns {Promise<Map<string, Object>>} User ACL data
     */
    async getByUsers({ usersId }) {
        return this.userRolesMapper.rolesByUsersToDomain(await this.userRolesService.getByUsers({ usersId }));
    }

    /**
     * Creates user roles
     *
     * @param {import("pg-promise").ITask<unknown>} params.clientTx Database transaction
     * @param {string} params.userId User identifier
     * @param {string[]} params.roles User roles
     * @param {string[] | undefined} params.scope Administrative scope
     * @returns {Promise<Object>} User ACL data
     */
    async createMany({ clientTx, userId, roles, scope }) {
        const source = await this.userRolesService.createMany({
            clientTx,
            userRoles: this.userRolesMapper.rolesToPersistence({ userId, roles, scope })
        });
        return this.userRolesMapper.rolesByUsersToDomain(source).get(userId);
    }

    /**
     * Replaces user roles
     *
     * @param {import("pg-promise").ITask<unknown>} params.clientTx Database transaction
     * @param {string} params.userId User identifier
     * @param {string[]} params.roles User roles
     * @param {string[] | undefined} params.scope Administrative scope
     * @returns {Promise<Object>} User ACL data
     */
    async replace({ clientTx, userId, roles, scope }) {
        const source = await this.userRolesService.replace({
            clientTx,
            userId,
            userRoles: this.userRolesMapper.rolesToPersistence({ userId, roles, scope })
        });
        return this.userRolesMapper.rolesByUsersToDomain(source).get(userId);
    }
}
