import jwt from "jsonwebtoken";
import ValidateUtils from "./validate-utils.js";
import { API_ERROR } from "../config/errors.js";
import { SECRETS } from "../config/secrets.js";
import { ENV } from "../config/environment.js";

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
     * @returns {string} JWT token
     */
    static generateAccessToken(payload) {
        return jwt.sign(payload, SECRETS.jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
    }

    /**
     * Generates a refresh token associated with a user session
     *
     * @param {Object} payload JWT payload
     * @returns {string} JWT refresh token
     */
    static generateRefreshToken(payload) {
        return jwt.sign(payload, SECRETS.refreshJwtSecret, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
    }

    /**
     * Verifies and decodes an access token
     *
     * @param {string} token JWT access token
     * @returns {import("jsonwebtoken").JwtPayload} Decoded token payload
     */
    static verifyAccessToken(token) {
        return verifyToken(token, SECRETS.jwtSecret);
    }

    /**
     * Verifies and decodes a refresh token
     *
     * @param {string} token JWT refresh token
     * @returns {import("jsonwebtoken").JwtPayload} Decoded token payload
     */
    static verifyRefreshToken(token) {
        return verifyToken(token, SECRETS.refreshJwtSecret);
    }
}

const {
    jwtAccessTokenExpiresIn: ACCESS_TOKEN_EXPIRES_IN,
    jwtRefreshTokenExpiresIn: REFRESH_TOKEN_EXPIRES_IN
} = ENV;

function verifyToken(token, secret) {
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        ValidateUtils.handleApiErrors([
            {
                condition: err instanceof jwt.JsonWebTokenError,
                message: "Token no válido",
                status: 401,
                apiError: API_ERROR.invalidToken
            }
        ]);

        throw err;
    }
}
