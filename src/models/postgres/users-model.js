import PostgresClient from "../../config/db/postgres-client.js";
import usersColumns from "./users-columns.js";

/**
 * Users table model
 *
 * @author HattoriHanzo-Ronin
 */
export default class UsersModel {
    /**
     * Gets all users
     *
     * @returns {Promise<Object[]>} List of users
     */
    static async getAll() {
        return client.any(`select ${basicInfoColumns.names} from users`);
    }

    /**
     * Gets a user by identifier
     *
     * @param {string} params.id User identifier
     * @returns {Promise<Object | null>} User data
     */
    static async getById({ id }) {
        return client.oneOrNone(`select ${basicInfoColumns.names} from users where id = $1`, [id]);
    }

    /**
     * Authenticates a user
     *
     * @param {string} params.username Username
     * @param {string} params.password Password
     * @returns {Promise<Object | null>} User data
     */
    static async authenticate({ username, password }) {
        return client.oneOrNone(
            `select ${authenticationColumns.names} from users 
             where username = $1 and password = crypt($2, password)`,
            [username, password]
        );
    }

    /**
     * Checks a user's password
     *
     * @param {string} params.id User identifier
     * @param {string} params.password User password
     * @returns {Promise<Object | null>} Password check result
     */
    static async checkPassword({ id, password }) {
        return client.oneOrNone("select true from users where id = $1 and password = crypt($2, password)", [id, password]);
    }

    /**
     * Inserts a user
     *
     * @param {import("pg-promise").ITask<unknown>} params.clientTx PostgreSQL transaction client
     * @param {Object} params.user User data
     * @returns {Promise<Object>} Inserted user data
     */
    static async insert({ clientTx, user }) {
        return clientTx.one(helpers().insert(user, insertColumns) + ` returning ${basicInfoColumns.names}`);
    }

    /**
     * Updates a user
     *
     * @param {import("pg-promise").ITask<unknown>} params.clientTx PostgreSQL transaction client
     * @param {string} params.id User identifier
     * @param {Object} params.data User data
     * @returns {Promise<Object | null>} Updated user data
     */
    static async update({ clientTx, id, data }) {
        return clientTx.oneOrNone(
            helpers().update(data, updateColumns) + ` where id = $1 returning ${basicInfoColumns.names}`,
            [id]
        );
    }

    /**
     * Deletes a user
     *
     * @param {string} params.id User identifier
     * @returns {Promise<{ id: string } | null>} Deleted user identifier
     */
    static async delete({ id }) {
        return client.oneOrNone("delete from users where id = $1 returning id", [id]);
    }
}

const { getClient, helpers } = PostgresClient;
const client = getClient();
const {
    basicInfo: basicInfoColumns,
    authentication: authenticationColumns,
    insert: insertColumns,
    update: updateColumns
} = usersColumns;
