import type UserRolesService from "../user-roles-service.js";
import type { UserRolesServiceDependencies } from "../../types/user-roles/default-user-roles-service.js";
import type { UsersByIdParams } from "../../types/user-roles/user-roles-model.js";
import type { CreateUserRolesParams, ReplaceUserRolesParams } from "../../types/user-roles/user-roles-service.js";
import ApiError from "../../utils/error/api-error.js";
import { API_ERROR } from "../../config/errors.js";

const { aclRoleRequired, aclRoleCreateFailed, aclRoleUpdateFailed } = API_ERROR;

/**
 * Default user roles service
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultUserRolesService<Transaction> implements UserRolesService<Transaction> {
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
                    message: "Error al crear los roles del usuario",
                    apiError: aclRoleCreateFailed
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
                    message: "Error al actualizar los roles del usuario",
                    apiError: aclRoleUpdateFailed
                }
            ]);
            throw err;
        }
    }
}
