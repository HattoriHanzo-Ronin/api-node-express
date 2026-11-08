import type { AuthUserParams } from "../../types/auth/auth-facade.js";
import type {
    AllowedManageParams,
    FilterAclParams,
    ForbiddenParams,
    UsersFacadeDependencies
} from "../../types/users/default-users-facade.js";
import type UsersFacade from "../users-facade.js";
import type {
    ChangePasswordParams,
    CreateUserParams,
    GetUserParams,
    GetUserWithoutAuthParams,
    UpdateUserParams,
    UserResponse
} from "../../types/users/users-facade.js";
import type { UserCredentials } from "../../types/users/users-model.js";
import type { MappedUser } from "../../types/users/users-mapper.js";
import type { Role } from "../../types/user-roles/user-roles-model.js";
import ApiError from "../../utils/error/api-error.js";
import { SOCKET_ENTITY, USER_ROLE } from "../../config/constants.js";
import { API_ERROR } from "../../config/errors.js";

const { admin } = USER_ROLE;
const { userNotFound, aclPermissionDenied } = API_ERROR;

/**
 * Users facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultUsersFacade<Transaction> implements UsersFacade {
    constructor(private readonly dependencies: UsersFacadeDependencies<Transaction>) {}

    async getAll({ authUser }: AuthUserParams) {
        const [versionResult, result] = await Promise.all([
            this.dependencies.dataVersionsFacade.getById({ id: SOCKET_ENTITY.users }),
            this.dependencies.usersService.getAll({})
        ]);
        const { version } = versionResult;
        const aclByUser = await this.dependencies.userRolesFacade.getByUsers({ usersId: result.map(({ id }) => id) });
        const users = this.dependencies.usersMapper.usersToDomain({ users: result, aclByUser });
        const data = users
            .filter(({ roles }) => this.allowedManage({ authUser, userRoles: roles }))
            .map((user) => this.filterAcl({ authUser, source: user }));
        return { version, data };
    }

    async getById(params: GetUserWithoutAuthParams): Promise<MappedUser>;
    async getById(params: GetUserParams): Promise<UserResponse>;
    async getById({ authUser, id }: GetUserParams): Promise<UserResponse> {
        const result = await this.dependencies.usersService.getById({ id });
        const aclByUser = await this.dependencies.userRolesFacade.getByUsers({ usersId: [id] });
        const user = this.dependencies.usersMapper.userToDomain({ source: result, acl: aclByUser.get(id) });
        ApiError.handle([
            {
                condition: Boolean(authUser && !this.allowedManage({ authUser, userRoles: user.roles })),
                message: "El usuario no existe",
                status: 404,
                apiError: userNotFound
            }
        ]);
        if (!authUser) {
            return user;
        }

        return this.filterAcl({ authUser, source: user });
    }

    async authenticate({ username, password }: UserCredentials) {
        const { id } = await this.dependencies.usersService.authenticate({ username, password });
        const aclByUser = await this.dependencies.userRolesFacade.getByUsers({ usersId: [id] });
        return this.dependencies.usersMapper.userToDomain({ source: { id, username }, acl: aclByUser.get(id) });
    }

    async create({ authUser, user }: CreateUserParams) {
        const { roles, scope: userScope, ...newUser } = user;
        let userRoles = roles;
        const { scope: authScope } = authUser;
        const superAdmin = authScope!.includes(admin);
        if (!superAdmin) {
            this.forbiddenError({ condition: userRoles || userScope });
            userRoles = authScope!;
        }

        const result = await this.dependencies.tx(async (clientTx) => {
            const result = await this.dependencies.usersService.create({ clientTx, user: newUser });
            const acl = await this.dependencies.userRolesFacade.createMany({
                clientTx,
                userId: result.id,
                roles: userRoles,
                scope: userScope
            });
            const createdUser = this.dependencies.usersMapper.userToDomain({ source: result, acl });
            return this.filterAcl({ authUser, source: createdUser });
        });
        await this.notify();
        return result;
    }

    async update({ authUser, data, changePassword = false }: UpdateUserParams) {
        let userRoles: Role[];
        let userScope: Role[] | undefined;
        const { id: updatedUserId, roles: updatedUserRoles, scope: updatedUserScope, ...newData } = data;
        const { id: authUserId, roles: authUserRoles, scope: authUserScope } = authUser;
        const { active, password } = newData;
        const isAdmin = authUserRoles.includes(admin);
        const superAdmin = authUserScope?.includes(admin);
        const isSelf = authUserId === updatedUserId;
        const updatesActive = active != null;
        const user = await this.dependencies.usersService.getById({ id: updatedUserId });
        if (isAdmin) {
            const aclByUser = await this.dependencies.userRolesFacade.getByUsers({ usersId: [updatedUserId] });
            const { roles: tempRoles, scope: tempScope } = this.dependencies.usersMapper.userToDomain({
                source: user,
                acl: aclByUser.get(updatedUserId)
            });
            userRoles = tempRoles;
            userScope = tempScope;
        }

        ApiError.handle([
            {
                condition: !isAdmin,
                execute: () => {
                    this.forbiddenError({
                        condition:
                            updatedUserRoles ||
                            updatedUserScope ||
                            updatesActive ||
                            !isSelf ||
                            (password && !changePassword)
                    });
                }
            },
            {
                condition: isAdmin,
                execute: () => {
                    this.forbiddenError({ condition: isSelf && (updatesActive || (password && !changePassword)) });
                    ApiError.handle([
                        {
                            condition: !superAdmin,
                            execute: () => {
                                this.forbiddenError({
                                    condition:
                                        updatedUserRoles ||
                                        updatedUserScope ||
                                        !this.allowedManage({ authUser, userRoles })
                                });
                            }
                        },
                        {
                            condition: Boolean(superAdmin),
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
                                this.forbiddenError({ condition: wouldLoseAdminScope || wouldLoseAdminRole });
                            }
                        }
                    ]);
                }
            }
        ]);
        const result = await this.dependencies.tx(async (clientTx) => {
            const onlyUpdateAcl = Object.keys(newData).length === 0 && superAdmin;
            const result = onlyUpdateAcl
                ? user
                : await this.dependencies.usersService.update({ clientTx, id: updatedUserId, data: newData });
            if (!isAdmin) {
                const { username } = result!;
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
                    const acl = await this.dependencies.userRolesFacade.replace({
                        clientTx,
                        userId: updatedUserId,
                        roles: updatedUserRoles ?? userRoles,
                        scope: updatedUserScope ?? userScope
                    });
                    return this.dependencies.usersMapper.userToDomain({ source: result!, acl });
                }

                return { ...result, roles: userRoles, scope: userScope };
            }

            return result;
        });
        await this.notify();
        return result;
    }

    async changePassword({ authUser, currentPassword, newPassword }: ChangePasswordParams) {
        const { id } = authUser;
        await this.dependencies.usersService.checkPassword({ id, password: currentPassword });
        await this.update({ authUser, data: { id, password: newPassword }, changePassword: true });
    }

    async delete({ authUser, id }: GetUserParams) {
        await this.getById({ authUser, id });
        const result = await this.dependencies.usersService.delete({ id });
        await this.notify();
        return result;
    }

    private async notify(): Promise<void> {
        const { version } = await this.dependencies.dataVersionsFacade.getById({ id: SOCKET_ENTITY.users });
        this.dependencies.socketSessionsFacade.notify({ entity: SOCKET_ENTITY.users, data: { version } });
    }

    private allowedManage({ authUser, userRoles }: AllowedManageParams): boolean {
        return authUser.scope!.includes(admin) || userRoles.every((role) => authUser.scope!.includes(role));
    }

    private filterAcl({ authUser, source }: FilterAclParams): UserResponse {
        const canSeeAcl = !authUser || authUser.scope?.includes(admin);
        if (canSeeAcl) {
            return source;
        }

        const result = { ...source };
        delete result.roles;
        delete result.scope;
        return result;
    }

    private forbiddenError({ condition }: ForbiddenParams): void {
        ApiError.handle([
            {
                condition: Boolean(condition),
                message: "No tiene permisos para realizar esa acción",
                status: 403,
                apiError: aclPermissionDenied
            }
        ]);
    }
}
