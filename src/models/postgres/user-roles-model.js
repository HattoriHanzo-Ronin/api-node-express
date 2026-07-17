import PostgresClient from "../../config/db/postgres-client.js";
import userRolesColumns from "./user-roles-columns.js";

/**
 * User roles table model
 *
 * @author HattoriHanzo-Ronin
 */
export default class UserRolesModel {
    /**
     * Gets roles assigned to a user
     *
     * @param {string[]} params.usersId List of user identifiers
     * @returns {Promise<Object[]>} List of user roles
     */
    static async getByUsers({ usersId }) {
        return client.any(`select * from user_roles where user_id IN ($1:list)`, [usersId]);
    }

    /**
     * Inserts multiple user role assignments
     *
     * @param {import("pg-promise").ITask<unknown>} params.clientTx PostgreSQL transaction client
     * @param {Object[]} params.userRoles User role assignments
     * @returns {Promise<Object[]>} List of user roles
     */
    static async insertMany({ clientTx, userRoles }) {
        return clientTx.any(helpers().insert(userRoles, insertColumns) + " returning *");
    }

    /**
     * Deletes all roles assigned to a user
     *
     * @param {import("pg-promise").ITask<unknown>} params.clientTx PostgreSQL transaction client
     * @param {string} params.userId User identifier
     * @returns {Promise<void>}
     */
    static async deleteByUser({ clientTx, userId }) {
        return clientTx.none("delete from user_roles where user_id = $1", [userId]);
    }
}

const { getClient, helpers } = PostgresClient;
const client = getClient();
const { insert: insertColumns } = userRolesColumns;
