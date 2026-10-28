import ApiError from "../utils/error/api-error.js";
import { API_ERROR } from "../config/errors.js";

/**
 * Refresh service
 *
 * @author HattoriHanzo-Ronin
 */
export default class RefreshTokensService {
    constructor({ refreshTokensModel, entityError }) {
        this.refreshTokensModel = refreshTokensModel;
        this.entityError = entityError;
    }

    /**
     * Gets a refresh token
     *
     * @param {string} params.token Refresh token
     */
    async getByToken({ token }) {
        const result = await this.refreshTokensModel.getByToken({ token });
        ApiError.handle([
            { condition: !result, message: "Token no válido", status: 401, apiError: API_ERROR.invalidToken }
        ]);
    }

    /**
     * Creates a refresh token
     *
     * @param {string} params.userId User identifier
     * @param {string} params.token Refresh token
     */
    async create({ userId, token }) {
        try {
            await this.refreshTokensModel.insert({ refreshToken: { user_id: userId, token } });
        } catch (err) {
            this.entityError(err);
            throw err;
        }
    }

    /**
     * Deletes a refresh token
     *
     * @param {string} params.token Refresh token
     * @returns {Promise<void>}
     */
    async delete({ token }) {
        return this.refreshTokensModel.delete({ token });
    }
}
