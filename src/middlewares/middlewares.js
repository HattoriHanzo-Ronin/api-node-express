import express from "express";
import cors from "cors";
import multer from "multer";
import ApiError from "../utils/api-error.js";
import JWTUtils from "../utils/jwt-utils.js";
import { API_ERROR } from "../config/constants.js";

/**
 * Application middleware factory
 *
 * @author HattoriHanzo-Ronin
 */
export default class Middlewares {
    /**
     * Creates CORS middleware
     *
     * @param {string[] | undefined} acceptOrigins Accepted origins
     * @returns {import("express").RequestHandler} Express middleware
     */
    static cors(acceptOrigins) {
        return cors({
            origin: (origin, callback) => {
                if (acceptOrigins) {
                    if (acceptOrigins.includes(origin)) {
                        return callback(null, true);
                    }

                    return callback(new Error("No permitido"));
                }
                return callback(null, true);
            }
        });
    }

    /**
     * Creates JSON body parser middleware
     *
     * @returns {import("express").RequestHandler} Express middleware
     */
    static json() {
        return express.json();
    }

    /**
     * Creates multipart form-data middleware
     *
     * @returns {import("multer").Multer} Multer middleware factory
     */
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

    /**
     * Handles requests that do not match an application route
     *
     * @param {import("express").Request} req Express request
     * @param {import("express").Response} res Express response
     * @param {import("express").NextFunction} next Express next function
     */
    static routeNotFound(req, res, next) {
        next(new ApiError({ message: "Page not found", status: 404, apiError: API_ERROR.routeNotFound }));
    }

    /**
     * Handles application errors
     *
     * @param {Error} err Application error
     * @param {import("express").Request} req Express request
     * @param {import("express").Response} res Express response
     * @param {import("express").NextFunction} next Express next function
     */
    static errorHandler(err, req, res, next) {
        const status = err.status || 500;
        const isApiError = err instanceof ApiError;
        const message = isApiError ? err.message : "Error inesperado";
        const code = isApiError ? err.code : API_ERROR.internalError.code;
        let result = { code, message };
        if (err.details) {
            result = { ...result, details: err.details };
        }

        res.status(status).json(result);
    }

    /**
     * Requires a valid bearer access token
     *
     * @param {import("express").Request} req Express request
     * @param {import("express").Response} res Express response
     * @param {import("express").NextFunction} next Express next function
     */
    static requireAuth(req, res, next) {
        try {
            const { authorization } = req.headers;
            if (!authorization?.startsWith("Bearer ")) {
                throw new ApiError({
                    message: "No hay sesión",
                    status: 401,
                    apiError: API_ERROR.authenticationRequired
                });
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
                    throw new ApiError({
                        message: "No tiene permisos para realizar esa acción",
                        status: 403,
                        apiError: API_ERROR.aclPermissionDenied
                    });
                }

                next();
            } catch (err) {
                next(err);
            }
        };
    }
}
