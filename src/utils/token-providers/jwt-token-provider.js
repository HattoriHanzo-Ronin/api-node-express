import jwt from "jsonwebtoken";
import ValidateUtils from "../validate-utils.js";
import { API_ERROR } from "../../config/errors.js";

/**
 * JWT token provider
 *
 * @author HattoriHanzo-Ronin
 */
export default class JwtTokenProvider {
    constructor({ secret, expiresIn }) {
        this.secret = secret;
        this.expiresIn = expiresIn;
    }

    /**
     * Creates a signed token
     *
     * @param {Object} params.payload Token payload
     * @returns {string} Token
     */
    create({ payload }) {
        return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
    }

    /**
     * Verifies and decodes a token
     *
     * @param {string} params.token Token
     * @returns {import("jsonwebtoken").JwtPayload} Decoded token payload
     */
    verify({ token }) {
        try {
            return jwt.verify(token, this.secret);
        } catch (err) {
            handleApiErrors([{
                condition: err instanceof jwt.JsonWebTokenError,
                message: "Token no válido",
                status: 401,
                apiError: API_ERROR.invalidToken
            }]);

            throw err;
        }
    }
}

const { handleApiErrors } = ValidateUtils;
