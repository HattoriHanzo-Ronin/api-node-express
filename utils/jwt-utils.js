import jwt from "jsonwebtoken";
import ValidateUtils from "./validate-utils.js";
import { SECRETS } from "../config/constants.js";

/**
 * Centralizes JWT operations used by the authentication system
 *
 * @author HattoriHanzo-Ronin
 */
export default class JWTUtils {
    /**
     * Generates an access token containing user identity and roles
     *
     * @param {Object} payload JWT payload
     * @param {string | number} expiresIn Token expiration time
     * @returns {string} JWT token
     */
    static generateAccessToken(payload, expiresIn) {
        return jwt.sign(payload, jwtSecret, { expiresIn });
    }

    /**
     * Generates a refresh token associated with a user session
     *
     * @param {Object} payload JWT payload
     * @param {string | number} expiresIn Token expiration time
     * @returns {string} JWT refresh token
     */
    static generateRefreshToken(payload, expiresIn) {
        return jwt.sign(payload, refreshJwtSecret, { expiresIn });
    }

    /**
     * Verifies and decodes an access token
     *
     * @param {string} token JWT access token
     * @returns {import("jsonwebtoken").JwtPayload} Decoded token payload
     */
    static verifyAccessToken(token) {
        return verifyToken(token, jwtSecret);
    }

    /**
     * Verifies and decodes a refresh token
     *
     * @param {string} token JWT refresh token
     * @returns {import("jsonwebtoken").JwtPayload} Decoded token payload
     */
    static verifyRefreshToken(token) {
        return verifyToken(token, refreshJwtSecret);
    }
}

const { jwtSecret, refreshJwtSecret } = SECRETS;

function verifyToken(token, secret) {
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        ValidateUtils.handleApiErrors([
            {
                condition: err instanceof jwt.JsonWebTokenError,
                message: "Token no válido",
                status: 401,
                code: "INVALID_TOKEN"
            }
        ]);

        throw err;
    }
}
