import express from "express";
import busboy from "busboy";
import ApiError from "../utils/error/api-error.js";
import { API_ERROR } from "../config/errors.js";

const { routeNotFound, internalError, authenticationRequired, aclPermissionDenied } = API_ERROR;

/**
 * Application middleware factory
 *
 * @author HattoriHanzo-Ronin
 */
export default class Middlewares {
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
     * @returns {import("express").RequestHandler} Multipart middleware
     */
    static multipart() {
        return (req, res, next) => {
            if (!req.headers["content-type"]?.startsWith("multipart/form-data")) {
                next();
                return;
            }

            let parser;
            try {
                parser = busboy({ headers: req.headers });
            } catch (error) {
                next(error);
                return;
            }

            let fileStream;
            let nextCalled = false;
            parser.on("file", (fieldName, stream, { filename, mimeType }) => {
                if (nextCalled || fieldName !== "file" || !filename) {
                    stream.resume();
                    return;
                }

                nextCalled = true;
                fileStream = stream;
                req.file = { originalname: filename, mimetype: mimeType, stream };
                next();
            });
            parser.once("finish", () => {
                if (!nextCalled) {
                    nextCalled = true;
                    next();
                }
            });
            parser.once("error", (error) => {
                if (fileStream) {
                    fileStream.destroy(error);
                    return;
                }

                if (!nextCalled) {
                    nextCalled = true;
                    next(error);
                }
            });
            req.pipe(parser);
        };
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
        next(new ApiError({ message: "Page not found", status: 404, apiError: routeNotFound }));
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
        if (res.headersSent) {
            next(err);
            return;
        }

        const status = err.status || 500;
        const isApiError = err instanceof ApiError;
        const message = isApiError ? err.message : "Error inesperado";
        const code = isApiError ? err.code : internalError;
        let result = { code, message };
        if (err.details) {
            result = { ...result, details: err.details };
        }

        res.status(status).json(result);
    }

    /**
     * Requires a valid bearer access token
     *
     * @param {Object} params.accessTokenProvider Access token provider
     * @returns {import("express").RequestHandler} Express middleware
     */
    static requireAuth({ accessTokenProvider }) {
        return (req, res, next) => {
            try {
                const { authorization } = req.headers;
                if (!authorization?.startsWith("Bearer ")) {
                    throw new ApiError({
                        message: "No hay sesión",
                        status: 401,
                        apiError: authenticationRequired
                    });
                }

                const token = authorization.split(" ")[1];
                req.user = accessTokenProvider.verify({ token });
                next();
            } catch (err) {
                next(err);
            }
        };
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
                if (!roles.some((role) => userRoles.includes(role))) {
                    throw new ApiError({
                        message: "No tiene permisos para realizar esa acción",
                        status: 403,
                        apiError: aclPermissionDenied
                    });
                }

                next();
            } catch (err) {
                next(err);
            }
        };
    }
}
