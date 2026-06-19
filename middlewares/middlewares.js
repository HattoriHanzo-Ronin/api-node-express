import express from "express";
import cors from "cors";
import multer from "multer";
import ApiError from "../utils/api-error.js";
import JWTUtils from "../utils/jwt-utils.js";

/**
 * Application middleware factory
 *
 * @author HattoriHanzo-Ronin
 */
export default class Middlewares {
    static cors(acceptOrigins) {
        return cors({
            origin: (origin, callback) => {
                if (acceptOrigins) {
                    if (acceptOrigins.includes(origin)) return callback(null, true);
                    return callback(new Error("No permitido"));
                }
                return callback(null, true);
            }
        });
    }

    static json() {
        return express.json();
    }

    static mult() {
        return multer({ storage: multer.memoryStorage() });
    }

    /**
     * Wraps an async Express handler and forwards errors to the next middleware
     *
     * @param {Function} fn Async Express route handler
     * @returns {Function} Express middleware
     */
    static asyncHandler(fn) {
        return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
    }

    static errorHandler(err, req, res, next) {
        const status = err.status || 500;
        const message = err instanceof ApiError ? err.message : "Error inesperado";
        let result = { message };
        if (err.details) {
            result = { ...result, details: err.details };
        }

        res.status(status).json(result);
    }

    static requireAuth(req, res, next) {
        try {
            const { authorization } = req.headers;
            if (!authorization?.startsWith("Bearer ")) {
                throw new ApiError("No hay sesión", 401);
            }

            const token = authorization.split(" ")[1];
            req.user = JWTUtils.verifyAccessToken(token);
            next();
        } catch (err) {
            next(err);
        }
    }

    /**
     * Restricts access to users with the specified roles, requires the authentication middleware to run first
     *
     * @param {string[]} roles
     * @returns {import("express").RequestHandler}
     */
    static authorizedRoles(roles) {
        return (req, res, next) => {
            try {
                const { roles: userRoles } = req.user;
                if (!roles.some((it) => userRoles.includes(it))) {
                    throw new ApiError("No tiene permisos para realizar esa acción", 403);
                }

                next();
            } catch (err) {
                next(err);
            }
        };
    }
}
