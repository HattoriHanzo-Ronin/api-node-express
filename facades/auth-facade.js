import { API_ERROR, JWT } from "../config/constants.js";
import JWTUtils from "../utils/jwt-utils.js";

/**
 * Authentication service
 *
 * @author HattoriHanzo-Ronin
 */
export default class AuthFacade {
    constructor({ usersFacade, refreshTokensService }) {
        this.usersFacade = usersFacade;
        this.refreshTokensService = refreshTokensService;
    }

    /**
     * Authenticates a user and creates a new session
     *
     * @param {string} params.username Username
     * @param {string} params.password Password
     * @returns {Promise<object>} Authentication payload
     */
    async login({ username, password }) {
        return this.#createPayload(await this.usersFacade.authenticate({ username, password }));
    }

    /**
     * Refreshes an existing session
     *
     * @param {string} params.refreshToken Refresh token
     * @returns {Promise<object>} Authentication payload
     */
    async refresh({ refreshToken }) {
        try {
            await this.refreshTokensService.getByToken({ token: refreshToken });
            const { id } = verifyRefreshToken(refreshToken);
            const user = await this.usersFacade.getById({ id });
            await this.refreshTokensService.delete({ token: refreshToken });
            return this.#createPayload(user);
        } catch (err) {
            if (err.code === API_ERROR.invalidToken.code) {
                await this.refreshTokensService.delete({ token: refreshToken });
            }

            throw err;
        }
    }

    /**
     * Revokes an existing session
     *
     * @param {string} params.refreshToken Refresh token
     * @returns {Promise<void>}
     */
    async logout({ refreshToken }) {
        return this.refreshTokensService.delete({ token: refreshToken });
    }

    /**
     * Creates an authentication payload for a user
     *
     * @param {Object} user User data
     * @returns {Promise<object>} Authentication payload
     */
    async #createPayload(user) {
        const { id, username, roles, scope } = user;
        const refreshToken = generateRefreshToken({ id }, refreshTokenExpiresIn);
        await this.refreshTokensService.create({ userId: id, token: refreshToken });
        return {
            user: { id, username, roles, scope },
            accessToken: generateAccessToken({ id, username, roles, scope }, accessTokenExpiresIn),
            refreshToken
        };
    }
}

const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = JWTUtils;
const { accessTokenExpiresIn, refreshTokenExpiresIn } = JWT;
