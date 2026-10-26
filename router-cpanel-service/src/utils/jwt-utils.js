import jwt from "jsonwebtoken";
import { API_ERROR } from "../config/errors.js";
import { SECRETS } from "../config/secrets.js";
import { ENV } from "../config/environment.js";
import ApiError from "./error/api-error.js";

/**
 * Centralizes JWT operations used by router control panel sessions
 *
 * @author HattoriHanzo-Ronin
 */
export default class JWTUtils {
    /**
     * Generates a token for a router control panel session
     *
     * @param {{ sid: string }} payload JWT payload
     * @returns {string} JWT token
     */
    static generateAccessToken(payload) {
        return jwt.sign(payload, SECRETS.jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
    }

    /**
     * Verifies and decodes a router control panel session token
     *
     * @param {string} token JWT token
     * @returns {import("jsonwebtoken").JwtPayload} Decoded token payload
     */
    static verifyAccessToken(token) {
        try {
            return jwt.verify(token, SECRETS.jwtSecret);
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

const { jwtAccessTokenExpiresIn: ACCESS_TOKEN_EXPIRES_IN } = ENV;
