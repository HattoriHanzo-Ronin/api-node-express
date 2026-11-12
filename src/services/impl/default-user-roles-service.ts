import type UserRolesService from "../user-roles-service.js";
import type { UserRolesServiceDependencies } from "../../types/user-roles/default-user-roles-service.js";
import type { UsersByIdParams } from "../../types/user-roles/user-roles-model.js";
import type { CreateUserRolesParams, ReplaceUserRolesParams } from "../../types/user-roles/user-roles-service.js";
import ApiError from "../../utils/error/api-error.js";
import Logger from "../../utils/logger/logger.js";
import { LOG_EVENT } from "../../config/log-events.js";
import { API_ERROR } from "../../config/errors.js";

const { aclRoleRequired, aclRoleCreateFailed, aclRoleUpdateFailed } = API_ERROR;

/**
 * Default user roles service
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultUserRolesService<Transaction> implements UserRolesService<Transaction> {
    private static readonly LOGGER = Logger.getLogger(DefaultUserRolesService);

    private readonly userRolesModel: UserRolesServiceDependencies<Transaction>["userRolesModel"];

    constructor({ userRolesModel }: UserRolesServiceDependencies<Transaction>) {
        this.userRolesModel = userRolesModel;
    }

    async getByUsers({ usersId }: UsersByIdParams) {
        return this.userRolesModel.getByUsers({ usersId });
    }

    async createMany({ clientTx, userRoles }: CreateUserRolesParams<Transaction>) {
        try {
            ApiError.handle([
                {
                    condition: !userRoles,
                    message: "Se debe especificar al menos un rol para el usuario",
                    apiError: aclRoleRequired
                }
            ]);
            return await this.userRolesModel.insertMany({ clientTx, userRoles: userRoles! });
        } catch (err) {
            ApiError.handle([
                {
                    condition: !(err instanceof ApiError && err.code === aclRoleRequired),
                    execute: () => {
                        if (!(err instanceof ApiError)) {
                            DefaultUserRolesService.LOGGER.error({
                                event: LOG_EVENT.databaseOperationFailed,
                                message: "Failed to create user roles",
                                error: err
                            });
                        }
                    },
                    message: "Error al crear los roles del usuario",
                    apiError: aclRoleCreateFailed,
                    cause: err
                }
            ]);
            throw err;
        }
    }

    async replace({ clientTx, userId, userRoles }: ReplaceUserRolesParams<Transaction>) {
        try {
            await this.userRolesModel.deleteByUser({ clientTx, userId });
            return await this.createMany({ clientTx, userRoles });
        } catch (err) {
            ApiError.handle([
                {
                    condition: !(err instanceof ApiError && err.code === aclRoleRequired),
                    execute: () => {
                        if (!(err instanceof ApiError)) {
                            DefaultUserRolesService.LOGGER.error({
                                event: LOG_EVENT.databaseOperationFailed,
                                message: "Failed to update user roles",
                                error: err
                            });
                        }
                    },
                    message: "Error al actualizar los roles del usuario",
                    apiError: aclRoleUpdateFailed,
                    cause: err
                }
            ]);
            throw err;
        }
    }
}
