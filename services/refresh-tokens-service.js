import ValidateUtils from "../utils/validate-utils.js";

/**
 * Refresh service
 *
 * @author HattoriHanzo-Ronin
 */
export default class RefreshTokensService {
    constructor({ refreshTokensModel }) {
        this.refreshTokensModel = refreshTokensModel;
    }

    /**
     * Gets a refresh token
     *
     * @param {string} params.token Refresh token
     */
    async getByToken({ token }) {
        const result = await this.refreshTokensModel.getByToken({ token });
        handleApiErrors([{ condition: !result, message: "Token no válido", status: 401 }]);
    }

    /**
     * Creates a refresh token
     *
     * @param {string} params.user_id User identifier
     * @param {string} params.token Refresh token
     */
    async create({ userId, token }) {
        try {
            await this.refreshTokensModel.insert({ refreshToken: { user_id: userId, token } });
        } catch (err) {
            handleApiErrors([{ condition: err.code === "23503", message: "El usuario no existe", status: 404 }]);
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

const { handleApiErrors } = ValidateUtils;
