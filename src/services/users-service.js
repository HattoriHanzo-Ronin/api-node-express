import ApiError from "../utils/error/api-error.js";
import ValidateUtils from "../utils/validate-utils.js";
import { API_ERROR } from "../config/errors.js";

/**
 * Users service
 *
 * @author HattoriHanzo-Ronin
 */
export default class UsersService {
    constructor({ usersModel, entityError }) {
        this.usersModel = usersModel;
        this.entityError = entityError;
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
        ApiError.handle([{ condition: !result, message: "El usuario no existe", status: 404, apiError: userNotFound }]);
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
        ApiError.handle([
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
     * Checks a user's password
     *
     * @param {string} params.id User identifier
     * @param {string} params.password User password
     */
    async checkPassword({ id, password }) {
        const result = await this.usersModel.checkPassword({ id, password });
        ApiError.handle([
            {
                condition: !result,
                message: "Contraseña incorrecta",
                status: 401,
                apiError: userIncorrectPassword
            }
        ]);
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
            this.entityError(err);
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
            ValidateUtils.validateNotEmptyObject(data, userEmptyUpdate);
            return await this.usersModel.update({ clientTx, id, data });
        } catch (err) {
            this.entityError(err);
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

const { userNotFound, userInvalidCredentials, userIncorrectPassword, userEmptyUpdate } = API_ERROR;
