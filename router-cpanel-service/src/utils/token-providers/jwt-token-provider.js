import jwt from "jsonwebtoken";
import { API_ERROR } from "../../config/errors.js";
import ApiError from "../error/api-error.js";

/**
 * JWT token provider for router control panel sessions
 *
 * @author HattoriHanzo-Ronin
 */
export default class JwtTokenProvider {
    #secret;
    #expiresIn;

    constructor({ secret, expiresIn }) {
        this.#secret = secret;
        this.#expiresIn = expiresIn;
    }

    /**
     * Creates a signed session token
     *
     * @param {Object} params.payload Token payload
     * @returns {string} Token
     */
    create({ payload }) {
        return jwt.sign(payload, this.#secret, { expiresIn: this.#expiresIn });
    }

    /**
     * Verifies and decodes a session token
     *
     * @param {string} params.token Token
     * @returns {import("jsonwebtoken").JwtPayload} Decoded token payload
     */
    verify({ token }) {
        try {
            return jwt.verify(token, this.#secret);
        } catch (err) {
            ApiError.handle([{
                condition: err instanceof jwt.JsonWebTokenError,
                message: "Sesión no válida",
                status: 401,
                apiError: API_ERROR.routerSessionInvalid
            }]);

            throw err;
        }
    }
}
