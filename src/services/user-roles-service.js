import ApiError from "../utils/error/api-error.js";
import { API_ERROR } from "../config/errors.js";

/**
 * User roles service
 *
 * @author HattoriHanzo-Ronin
 */
export default class UserRolesService {
    constructor({ userRolesModel }) {
        this.userRolesModel = userRolesModel;
    }

    /**
     * Gets roles assigned to users
     *
     * @param {string[]} params.usersId List of user identifiers
     * @returns {Promise<Object[][]>} User roles grouped by user
     */
    async getByUsers({ usersId }) {
        return this.userRolesModel.getByUsers({ usersId });
    }

    /**
     * Creates multiple role assignments for a user
     *
     * @param {import("pg-promise").ITask<unknown>} params.clientTx PostgreSQL transaction client
     * @param {Object[]} params.userRoles Persistence user role assignments
     * @returns {Promise<Object[]>} Created user role assignments
     */
    async createMany({ clientTx, userRoles }) {
        try {
            ApiError.handle([
                {
                    condition: !userRoles,
                    message: "Se debe especificar al menos un rol para el usuario",
                    apiError: aclRoleRequired
                }
            ]);
            return await this.userRolesModel.insertMany({ clientTx, userRoles });
        } catch (err) {
            ApiError.handle([
                {
                    condition: err.code !== aclRoleRequired,
                    message: "Error al crear los roles del usuario",
                    apiError: aclRoleCreateFailed
                }
            ]);
            throw err;
        }
    }

    /**
     * Replaces all roles assigned to a user
     *
     * @param {import("pg-promise").ITask<unknown>} params.clientTx PostgreSQL transaction client
     * @param {string} params.userId User identifier
     * @param {Object[]} params.userRoles Persistence user role assignments
     * @returns {Promise<Object[]>} Updated user role assignments
     */
    async replace({ clientTx, userId, userRoles }) {
        try {
            await this.userRolesModel.deleteByUser({ clientTx, userId });
            return await this.createMany({ clientTx, userRoles });
        } catch (err) {
            ApiError.handle([
                {
                    condition: err.code !== aclRoleRequired,
                    message: "Error al actualizar los roles del usuario",
                    apiError: aclRoleUpdateFailed
                }
            ]);
            throw err;
        }
    }
}

const { aclRoleRequired, aclRoleCreateFailed, aclRoleUpdateFailed } = API_ERROR;
