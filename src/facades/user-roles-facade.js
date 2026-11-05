/**
 * User roles facade
 *
 * @author HattoriHanzo-Ronin
 * @template Transaction
 */
export default class UserRolesFacade {
    #userRolesService;
    #userRolesMapper;

    constructor({ userRolesService, userRolesMapper }) {
        this.#userRolesService = userRolesService;
        this.#userRolesMapper = userRolesMapper;
    }

    /**
     * Returns user ACL data indexed by user identifier
     *
     * @param {{ usersId: string[] }} params User identifiers
     * @returns {Promise<Map<string, import("../types/user-roles-facade.js").UserAcl>>} User ACL data
     */
    async getByUsers({ usersId }) {
        return this.#userRolesMapper.rolesByUsersToDomain(await this.#userRolesService.getByUsers({ usersId }));
    }

    /**
     * Creates user roles
     *
     * @param {import("../types/user-roles-facade.js").UserRolesWriteParams<Transaction>} params User role assignment
     * @returns {Promise<import("../types/user-roles-facade.js").UserAcl | undefined>} User ACL data
     */
    async createMany({ clientTx, userId, roles, scope }) {
        const source = await this.#userRolesService.createMany({
            clientTx,
            userRoles: this.#userRolesMapper.rolesToPersistence({ userId, roles, scope })
        });
        return this.#userRolesMapper.rolesByUsersToDomain(source).get(userId);
    }

    /**
     * Replaces user roles
     *
     * @param {import("../types/user-roles-facade.js").UserRolesWriteParams<Transaction>} params User role assignment
     * @returns {Promise<import("../types/user-roles-facade.js").UserAcl | undefined>} User ACL data
     */
    async replace({ clientTx, userId, roles, scope }) {
        const source = await this.#userRolesService.replace({
            clientTx,
            userId,
            userRoles: this.#userRolesMapper.rolesToPersistence({ userId, roles, scope })
        });
        return this.#userRolesMapper.rolesByUsersToDomain(source).get(userId);
    }
}
