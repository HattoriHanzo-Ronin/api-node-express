import express from "express";
import { API_ERROR } from "../config/errors.js";
import ApiError from "../utils/error/api-error.js";

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
        if (res.headersSent) {
            next(err);
            return;
        }

        const status = err.status ?? 500;
        const isApiError = err instanceof ApiError;
        const message = isApiError ? err.message : "Error inesperado";
        const code = isApiError ? err.code : API_ERROR.internalError.code;
        res.status(status).json({ code, message });
    }
}
