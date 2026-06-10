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
     * @param {string} params.id User identifier
     * @param {string[]} params.roles User roles
     * @param {string | number} params.expiresIn Token expiration time
     * @returns {string} JWT token
     */
    static generateAccessToken({ id, roles, expiresIn }) {
        return jwt.sign({ id, roles }, jwtSecret, { expiresIn });
    }

    /**
     * Generates a refresh token associated with a user session
     *
     * @param {string} params.id User identifier
     * @param {string | number} params.expiresIn Token expiration time
     * @returns {string} JWT refresh token
     */
    static generateRefreshToken({ id, expiresIn }) {
        return jwt.sign({ id }, refreshJwtSecret, { expiresIn });
    }

    /**
     * Verifies and decodes an access token
     *
     * @param {string} params.token JWT access token
     * @returns {import("jsonwebtoken").JwtPayload} Decoded token payload
     */
    static verifyAccessToken({ token }) {
        return verifyToken(token, jwtSecret);
    }

    /**
     * Verifies and decodes a refresh token
     *
     * @param {string} params.token JWT refresh token
     * @returns {import("jsonwebtoken").JwtPayload} Decoded token payload
     */
    static verifyRefreshToken({ token }) {
        return verifyToken(token, refreshJwtSecret);
    }
}

const { jwtSecret, refreshJwtSecret } = SECRETS;

function verifyToken(token, secret) {
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        ValidateUtils.handleApiErrors([
            { condition: err.name === "TokenExpiredError", message: "Token expirado", status: 401 },
            { condition: true, message: "Token no válido", status: 401 }
        ]);
    }
}
