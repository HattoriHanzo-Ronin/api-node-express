import ValidateUtils from "../utils/validate-utils.js";
import { API_ERROR, USER_ROLE } from "../config/constants.js";

const { admin } = USER_ROLE;
const { userNotFound, aclPermissionDenied } = API_ERROR;

/**
 * Users facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class UsersFacade {
    constructor({ usersService, dataVersionsService, userRolesService, usersMapper, tx }) {
        this.usersService = usersService;
        this.dataVersionsService = dataVersionsService;
        this.userRolesService = userRolesService;
        this.usersMapper = usersMapper;
        this.tx = tx;
    }

    /**
     * Retrieves all users accessible by the authenticated user
     *
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ version: string, data: Object[] }>} User collection
     */
    async getAll({ authUser }) {
        const [{ version }, result] = await Promise.all([
            this.dataVersionsService.getById({ id: "users" }),
            this.usersService.getAll()
        ]);
        const roles = await this.userRolesService.getByUsers({ usersId: result.map(({ id }) => id) });
        const users = this.usersMapper.usersToDomain({ users: result, roles });
        const data = users.filter((it) => allowedManage(authUser, it.roles)).map((it) => filterAcl(authUser, it));
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
                apiError: userNotFound
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
        const superAdmin = authScope.includes(admin);
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
        const { id: updatedUserId, roles: updatedUserRoles, scope: updatedUserScope, ...newData } = data;
        const { id: authUserId, roles: authUserRoles, scope: authUserScope } = authUser;
        const { active } = newData;
        const isAdmin = authUserRoles.includes(admin);
        const superAdmin = authUserScope?.includes(admin);
        const isSelf = authUserId === updatedUserId;
        const updatesActive = active != null;
        const user = await this.usersService.getById({ id: updatedUserId });
        if (isAdmin) {
            const roles = await this.userRolesService.getByUsers({ usersId: [updatedUserId] });
            const { roles: tempRoles, scope: tempScope } = this.usersMapper.userToDomain({ ...user, roles });
            userRoles = tempRoles;
            userScope = tempScope;
        }

        handleApiErrors([
            {
                condition: !isAdmin,
                execute: () => {
                    forbiddendError(updatedUserRoles || updatedUserScope || updatesActive || !isSelf);
                }
            },
            {
                condition: isAdmin,
                execute: () => {
                    forbiddendError(isSelf && updatesActive);
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
                                    userScope.includes(admin) &&
                                    updatedUserScope &&
                                    !updatedUserScope.includes(admin);
                                const wouldLoseAdminRole =
                                    isSelf &&
                                    userRoles.includes(admin) &&
                                    updatedUserRoles &&
                                    !updatedUserRoles.includes(admin);
                                forbiddendError(wouldLoseAdminScope || wouldLoseAdminRole);
                            }
                        }
                    ]);
                }
            }
        ]);
        return this.tx(async (clientTx) => {
            const onlyUpdateAcl = Object.keys(newData).length === 0 && superAdmin;
            const result = onlyUpdateAcl
                ? user
                : await this.usersService.update({ clientTx, id: updatedUserId, data: newData });
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
    return scope.includes(admin) || userRoles.every((it) => scope.includes(it));
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
    const canSeeAcl = !authUser || authUser.scope?.includes(admin);
    return canSeeAcl ? source : result;
}

function forbiddendError(condition) {
    handleApiErrors([
        { condition, message: "No tiene permisos para realizar esa acción", status: 403, apiError: aclPermissionDenied }
    ]);
}
