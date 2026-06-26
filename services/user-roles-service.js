import ValidateUtils from "../utils/validate-utils.js";

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
     * @param {string} params.userId User identifier
     * @param {string[]} params.roles User roles
     * @param {string[] | undefined} params.scope Administrative scope
     * @returns {Promise<Object[]>} Created user role assignments
     */
    async createMany({ clientTx, userId, roles, scope }) {
        try {
            const userRoles = roles.map((it) => ({
                user_id: userId,
                role: it,
                scope: it === "ADMIN" ? scope.join(",") : null
            }));
            return await this.userRolesModel.insertMany({ clientTx, userRoles });
        } catch (err) {
            handleApiErrors([
                { condition: true, message: "Error al crear los roles del usuario", code: "ACL_ROLE_CREATE_FAILED" }
            ]);
        }
    }

    /**
     * Replaces all roles assigned to a user
     *
     * @param {import("pg-promise").ITask<unknown>} params.clientTx PostgreSQL transaction client
     * @param {string} params.userId User identifier
     * @param {string[]} params.roles User roles
     * @param {string[] | undefined} params.scope Administrative scope
     * @returns {Promise<Object[]>} Updated user role assignments
     */
    async replace({ clientTx, userId, roles, scope }) {
        try {
            await this.userRolesModel.deleteByUser({ clientTx, userId });
            return await this.createMany({ clientTx, userId, roles, scope });
        } catch (err) {
            handleApiErrors([
                {
                    condition: true,
                    message: "Error al actualizar los roles del usuario",
                    code: "ACL_ROLE_UPDATE_FAILED"
                }
            ]);
        }
    }
}

const { handleApiErrors } = ValidateUtils;
