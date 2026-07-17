import PostgresErrors from "../utils/postgres-errors.js";
import ValidateUtils from "../utils/validate-utils.js";
import { API_ERROR } from "../config/constants.js";

/**
 * Users service
 *
 * @author HattoriHanzo-Ronin
 */
export default class UsersService {
    constructor({ usersModel }) {
        this.usersModel = usersModel;
    }

    /**
     * Gets all users
     *
     * @returns {Promise<Object[]>} List of users data
     */
    async getAll() {
        return this.usersModel.getAll();
    }

    /**
     * Gets a user by identifier
     *
     * @param {string} params.id User identifier
     * @returns {Promise<Object>} User data
     */
    async getById({ id }) {
        const result = await this.usersModel.getById({ id });
        handleApiErrors([{ condition: !result, message: "El usuario no existe", status: 404, apiError: userNotFound }]);
        return result;
    }

    /**
     * Authenticates a user
     *
     * @param {string} params.username Username
     * @param {string} params.password Password
     * @returns {Promise<Object>} Authenticated user data
     */
    async authenticate({ username, password }) {
        const result = await this.usersModel.authenticate({ username, password });
        const invalidUser = !result || !result.active;
        handleApiErrors([
            {
                condition: invalidUser,
                message: "Usuario o contraseña incorrectos",
                status: 401,
                apiError: userInvalidCredentials
            }
        ]);
        return result;
    }

    /**
     * Creates a user
     *
     * @param {import("pg-promise").ITask<unknown>} params.clientTx PostgreSQL transaction client
     * @param {Object} params.user User data
     * @returns {Promise<Object>} Created user data
     */
    async create({ clientTx, user }) {
        try {
            return await this.usersModel.insert({ clientTx, user });
        } catch (err) {
            postgresError(err);
            throw err;
        }
    }

    /**
     * Updates a user
     *
     * @param {import("pg-promise").ITask<unknown>} params.clientTx PostgreSQL transaction client
     * @param {string} params.id User identifier
     * @param {Object} params.data User data
     * @returns {Promise<Object>} Updated user data
     */
    async update({ clientTx, id, data }) {
        try {
            validateNotEmptyObject(data, userEmptyUpdate);
            return await this.usersModel.update({ clientTx, id, data });
        } catch (err) {
            postgresError(err);
            throw err;
        }
    }

    /**
     * Deletes a user
     *
     * @param {string} params.id User identifier
     * @returns {Promise<{ id: string }>} Deleted user identifier
     */
    async delete({ id }) {
        return this.usersModel.delete({ id });
    }
}

const { handleApiErrors, validateNotEmptyObject } = ValidateUtils;
const { userNotFound, userInvalidCredentials, userEmptyUpdate } = API_ERROR;
const { users: postgresError } = PostgresErrors;
