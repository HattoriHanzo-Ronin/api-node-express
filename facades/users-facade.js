import ValidateUtils from "../utils/validate-utils.js";

/**
 * Users facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class UsersFacade {
    constructor({ usersService, userRolesService, usersMapper, tx }) {
        this.usersService = usersService;
        this.userRolesService = userRolesService;
        this.usersMapper = usersMapper;
        this.tx = tx;
    }

    /**
     * Retrieves all users accessible by the authenticated user
     *
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<Object[]>} User collection
     */
    async getAll({ authUser }) {
        const result = await this.usersService.getAll();
        const roles = await this.userRolesService.getByUsers({ usersId: result.map(({ id }) => id) });
        const users = this.usersMapper.usersToDomain({ users: result, roles });
        return users.filter((it) => allowedManage(authUser, it.roles)).map((it) => filterAcl(authUser, it));
    }

    /**
     * Retrieves a user by identifier
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.id User identifier
     * @returns {Promise<Object>} User data
     */
    async getById({ authUser, id }) {
        const result = await this.usersService.getById({ id });
        const user = this.usersMapper.userToDomain({
            ...result,
            roles: await this.userRolesService.getByUsers({ usersId: [id] })
        });
        handleApiErrors([
            {
                condition: authUser && !allowedManage(authUser, user.roles),
                message: "El usuario no existe",
                status: 404,
                code: "USER_NOT_FOUND"
            }
        ]);
        return filterAcl(authUser, user);
    }

    /**
     * Authenticates a user and returns its domain representation
     *
     * @param {string} params.username Username
     * @param {string} params.password User password
     * @returns {Promise<Object>} Authenticated user
     */
    async authenticate({ username, password }) {
        const { id } = await this.usersService.authenticate({ username, password });
        return this.usersMapper.userToDomain({
            id,
            username,
            roles: await this.userRolesService.getByUsers({ usersId: [id] })
        });
    }

    /**
     * Creates a new user
     *
     * @param {Object} params.authUser Authenticated user
     * @param {Object} params.user User data
     * @returns {Promise<Object>} Created user
     */
    async create({ authUser, user }) {
        let { roles: userRoles, scope: userScope, ...newUser } = user;
        const { scope: authScope } = authUser;
        const superAdmin = authScope.includes("ADMIN");
        if (!superAdmin) {
            forbiddendError(userRoles || userScope);
            userRoles = authScope;
        }

        return this.tx(async (clientTx) => {
            const result = await this.usersService.create({ clientTx, user: newUser });
            const roles = await this.userRolesService.createMany({
                clientTx,
                userId: result.id,
                roles: userRoles,
                scope: userScope
            });
            const createdUser = this.usersMapper.userToDomain({ ...result, roles });
            return filterAcl(authUser, createdUser);
        });
    }

    /**
     * Updates an existing user
     *
     * @param {Object} params.authUser Authenticated user
     * @param {Object} params.data User data to update
     * @returns {Promise<Object>} Updated user
     */
    async update({ authUser, data }) {
        let userRoles;
        let userScope;
        const { id: updatedUserId, ...newData } = data;
        const { id: authUserId, roles: authUserRoles, scope: authUserScope } = authUser;
        const { roles: updatedUserRoles, scope: updatedUserScope, active } = newData;
        const isAdmin = authUserRoles.includes("ADMIN");
        const superAdmin = authUserScope?.includes("ADMIN");
        const isSelf = authUserId === updatedUserId;
        const cannotDeactivate = active != null;
        if (isAdmin) {
            const user = await this.usersService.getById({ id: updatedUserId });
            const roles = await this.userRolesService.getByUsers({ usersId: [updatedUserId] });
            const { roles: tempRoles, scope: tempScope } = this.usersMapper.userToDomain({ ...user, roles });
            userRoles = tempRoles;
            userScope = tempScope;
        }

        handleApiErrors([
            {
                condition: !isAdmin,
                execute: () => {
                    forbiddendError(updatedUserRoles || updatedUserScope || cannotDeactivate || !isSelf);
                }
            },
            {
                condition: isAdmin,
                execute: () => {
                    forbiddendError(isSelf && cannotDeactivate);
                    handleApiErrors([
                        {
                            condition: !superAdmin,
                            execute: () => {
                                forbiddendError(
                                    updatedUserRoles || updatedUserScope || !allowedManage(authUser, userRoles)
                                );
                            }
                        },
                        {
                            condition: superAdmin,
                            execute: () => {
                                const wouldLoseAdminScope =
                                    userScope &&
                                    userScope.includes("ADMIN") &&
                                    updatedUserScope &&
                                    !updatedUserScope.includes("ADMIN");
                                const wouldLoseAdminRole =
                                    isSelf &&
                                    userRoles.includes("ADMIN") &&
                                    updatedUserRoles &&
                                    !updatedUserRoles.includes("ADMIN");
                                forbiddendError(wouldLoseAdminScope || wouldLoseAdminRole);
                            }
                        }
                    ]);
                }
            }
        ]);
        return this.tx(async (clientTx) => {
            const result = await this.usersService.update({ clientTx, id: updatedUserId, data: newData });
            if (!isAdmin) {
                const { username } = result;
                return { username };
            }

            if (superAdmin) {
                const isUpdatedRoles =
                    updatedUserRoles &&
                    (updatedUserRoles.length !== userRoles.length ||
                        !userRoles.every((it) => updatedUserRoles.includes(it)));
                const isUpdatedScope =
                    updatedUserScope &&
                    (updatedUserScope.length !== userScope.length ||
                        !userScope.every((it) => updatedUserScope.includes(it)));
                if (isUpdatedRoles || isUpdatedScope) {
                    const roles = await this.userRolesService.replace({
                        clientTx,
                        userId: updatedUserId,
                        roles: updatedUserRoles ?? userRoles,
                        scope: updatedUserScope ?? userScope
                    });
                    return this.usersMapper.userToDomain({ ...result, roles });
                }

                return { ...result, roles: userRoles, scope: userScope };
            }

            return result;
        });
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
        return this.usersService.delete({ id });
    }
}

const { handleApiErrors } = ValidateUtils;

function allowedManage({ scope }, userRoles) {
    return scope.includes("ADMIN") || userRoles.every((it) => scope.includes(it));
}

/**
 * Filters ACL information from a user
 *
 * @param {Object | undefined} authUser Authenticated user
 * @param {Object} source User data
 * @returns {Object} Filtered user data
 */
function filterAcl(authUser, source) {
    const { roles, scope, ...result } = source;
    const canSeeAcl = !authUser || authUser.scope?.includes("ADMIN");
    return canSeeAcl ? source : result;
}

function forbiddendError(condition) {
    handleApiErrors([
        { condition, message: "No tiene permisos para realizar esa acción", status: 403, code: "ACL_PERMISSION_DENIED" }
    ]);
}
