import ApiError from "../utils/error/api-error.js";
import { SOCKET_ENTITY, USER_ROLE } from "../config/constants.js";
import { API_ERROR } from "../config/errors.js";

const { admin } = USER_ROLE;
const { userNotFound, aclPermissionDenied } = API_ERROR;

/**
 * Users facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class UsersFacade {
    #usersService;
    #dataVersionsFacade;
    #userRolesFacade;
    #usersMapper;
    #socketSessionsFacade;
    #tx;

    constructor({ usersService, dataVersionsFacade, userRolesFacade, usersMapper, socketSessionsFacade, tx }) {
        this.#usersService = usersService;
        this.#dataVersionsFacade = dataVersionsFacade;
        this.#userRolesFacade = userRolesFacade;
        this.#usersMapper = usersMapper;
        this.#socketSessionsFacade = socketSessionsFacade;
        this.#tx = tx;
    }

    /**
     * Retrieves all users accessible by the authenticated user
     *
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ version: string, data: Object[] }>} User collection
     */
    async getAll({ authUser }) {
        const [{ version }, result] = await Promise.all([
            this.#dataVersionsFacade.getById({ id: SOCKET_ENTITY.users }),
            this.#usersService.getAll()
        ]);
        const aclByUser = await this.#userRolesFacade.getByUsers({ usersId: result.map(({ id }) => id) });
        const users = this.#usersMapper.usersToDomain({ users: result, aclByUser });
        const data = users
            .filter(({ roles }) => this.#allowedManage({ authUser, userRoles: roles }))
            .map((user) => this.#filterAcl({ authUser, source: user }));
        return { version, data };
    }

    /**
     * Retrieves a user by identifier
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.id User identifier
     * @returns {Promise<Object>} User data
     */
    async getById({ authUser, id }) {
        const result = await this.#usersService.getById({ id });
        const aclByUser = await this.#userRolesFacade.getByUsers({ usersId: [id] });
        const user = this.#usersMapper.userToDomain({ source: result, acl: aclByUser.get(id) });
        ApiError.handle([
            {
                condition: authUser && !this.#allowedManage({ authUser, userRoles: user.roles }),
                message: "El usuario no existe",
                status: 404,
                apiError: userNotFound
            }
        ]);
        return this.#filterAcl({ authUser, source: user });
    }

    /**
     * Authenticates a user and returns its domain representation
     *
     * @param {string} params.username Username
     * @param {string} params.password User password
     * @returns {Promise<Object>} Authenticated user
     */
    async authenticate({ username, password }) {
        const { id } = await this.#usersService.authenticate({ username, password });
        const aclByUser = await this.#userRolesFacade.getByUsers({ usersId: [id] });
        return this.#usersMapper.userToDomain({ source: { id, username }, acl: aclByUser.get(id) });
    }

    /**
     * Creates a new user
     *
     * @param {Object} params.authUser Authenticated user
     * @param {Object} params.user User data
     * @returns {Promise<Object>} Created user
     */
    async create({ authUser, user }) {
        const { roles, scope: userScope, ...newUser } = user;
        let userRoles = roles;
        const { scope: authScope } = authUser;
        const superAdmin = authScope.includes(admin);
        if (!superAdmin) {
            this.#forbiddenError({ condition: userRoles || userScope });
            userRoles = authScope;
        }

        const result = await this.#tx(async (clientTx) => {
            const result = await this.#usersService.create({ clientTx, user: newUser });
            const acl = await this.#userRolesFacade.createMany({ clientTx, userId: result.id, roles: userRoles, scope: userScope });
            const createdUser = this.#usersMapper.userToDomain({ source: result, acl });
            return this.#filterAcl({ authUser, source: createdUser });
        });
        await this.#notify();
        return result;
    }

    /**
     * Updates an existing user
     *
     * @param {Object} params.authUser Authenticated user
     * @param {Object} params.data User data to update
     * @param {boolean} [params.changePassword] Whether the current password challenge was validated
     * @returns {Promise<Object>} Updated user
     */
    async update({ authUser, data, changePassword = false }) {
        let userRoles;
        let userScope;
        const { id: updatedUserId, roles: updatedUserRoles, scope: updatedUserScope, ...newData } = data;
        const { id: authUserId, roles: authUserRoles, scope: authUserScope } = authUser;
        const { active, password } = newData;
        const isAdmin = authUserRoles.includes(admin);
        const superAdmin = authUserScope?.includes(admin);
        const isSelf = authUserId === updatedUserId;
        const updatesActive = active != null;
        const user = await this.#usersService.getById({ id: updatedUserId });
        if (isAdmin) {
            const aclByUser = await this.#userRolesFacade.getByUsers({ usersId: [updatedUserId] });
            const { roles: tempRoles, scope: tempScope } = this.#usersMapper.userToDomain({ source: user, acl: aclByUser.get(updatedUserId) });
            userRoles = tempRoles;
            userScope = tempScope;
        }

        ApiError.handle([
            {
                condition: !isAdmin,
                execute: () => {
                    this.#forbiddenError({
                        condition: updatedUserRoles || updatedUserScope || updatesActive || !isSelf || (password && !changePassword)
                    });
                }
            },
            {
                condition: isAdmin,
                execute: () => {
                    this.#forbiddenError({ condition: isSelf && (updatesActive || (password && !changePassword)) });
                    ApiError.handle([
                        {
                            condition: !superAdmin,
                            execute: () => {
                                this.#forbiddenError({
                                    condition: updatedUserRoles || updatedUserScope ||
                                        !this.#allowedManage({ authUser, userRoles })
                                });
                            }
                        },
                        {
                            condition: superAdmin,
                            execute: () => {
                                const wouldLoseAdminScope =
                                    userScope &&
                                    userScope.includes(admin) &&
                                    updatedUserScope &&
                                    !updatedUserScope.includes(admin);
                                const wouldLoseAdminRole =
                                    isSelf &&
                                    userRoles.includes(admin) &&
                                    updatedUserRoles &&
                                    !updatedUserRoles.includes(admin);
                                this.#forbiddenError({ condition: wouldLoseAdminScope || wouldLoseAdminRole });
                            }
                        }
                    ]);
                }
            }
        ]);
        const result = await this.#tx(async (clientTx) => {
            const onlyUpdateAcl = Object.keys(newData).length === 0 && superAdmin;
            const result = onlyUpdateAcl
                ? user
                : await this.#usersService.update({ clientTx, id: updatedUserId, data: newData });
            if (!isAdmin) {
                const { username } = result;
                return { username };
            }

            if (superAdmin) {
                const isUpdatedRoles =
                    updatedUserRoles &&
                    (updatedUserRoles.length !== userRoles.length ||
                        !userRoles.every((role) => updatedUserRoles.includes(role)));
                const currentUserScope = userScope ?? [];
                const isUpdatedScope =
                    updatedUserScope &&
                    (updatedUserScope.length !== currentUserScope.length ||
                        !currentUserScope.every((scope) => updatedUserScope.includes(scope)));
                if (isUpdatedRoles || isUpdatedScope) {
                    const acl = await this.#userRolesFacade.replace({
                        clientTx,
                        userId: updatedUserId,
                        roles: updatedUserRoles ?? userRoles,
                        scope: updatedUserScope ?? userScope
                    });
                    return this.#usersMapper.userToDomain({ source: result, acl });
                }

                return { ...result, roles: userRoles, scope: userScope };
            }

            return result;
        });
        await this.#notify();
        return result;
    }

    /**
     * Changes the authenticated user's password
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.currentPassword Current password
     * @param {string} params.newPassword New password
     */
    async changePassword({ authUser, currentPassword, newPassword }) {
        const { id } = authUser;
        await this.#usersService.checkPassword({ id, password: currentPassword });
        await this.update({ authUser, data: { id, password: newPassword }, changePassword: true });
    }

    /**
     * Deletes a user
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.id User identifier
     * @returns {Promise<void>}
     */
    async delete({ authUser, id }) {
        await this.getById({ authUser, id });
        const result = await this.#usersService.delete({ id });
        await this.#notify();
        return result;
    }

    async #notify() {
        const { version } = await this.#dataVersionsFacade.getById({ id: SOCKET_ENTITY.users });
        this.#socketSessionsFacade.notify({ entity: SOCKET_ENTITY.users, data: { version } });
    }

    #allowedManage({ authUser, userRoles }) {
        return authUser.scope.includes(admin) || userRoles.every((role) => authUser.scope.includes(role));
    }

    #filterAcl({ authUser, source }) {
        const canSeeAcl = !authUser || authUser.scope?.includes(admin);
        if (canSeeAcl) {
            return source;
        }

        const result = { ...source };
        delete result.roles;
        delete result.scope;
        return result;
    }

    #forbiddenError({ condition }) {
        ApiError.handle([{
            condition,
            message: "No tiene permisos para realizar esa acción",
            status: 403,
            apiError: aclPermissionDenied
        }]);
    }
}
