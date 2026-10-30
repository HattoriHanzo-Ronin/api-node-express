import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { API_ERROR } from "../config/errors.js";
import ApiError from "../utils/error/api-error.js";

/**
 * Application middleware factory
 *
 * @author HattoriHanzo-Ronin
 */
export default class Middlewares {
    /**
     * Wraps an async Express handler and forwards errors to the next middleware
     *
     * @param fn Async Express route handler
     * @returns Express middleware
     */
    static asyncHandler<Params extends Record<string, string>>(fn: RequestHandler<Params>): RequestHandler<Params> {
        return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
    }

    /**
     * Handles requests that do not match an application route
     *
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    static routeNotFound(req: Request, res: Response, next: NextFunction): void {
        next(new ApiError({ message: "Page not found", status: 404, apiError: API_ERROR.routeNotFound }));
    }

    /**
     * Handles application errors
     *
     * @param err Application error
     * @param req Express request
     * @param res Express response
     * @param next Express next function
     */
    static errorHandler: ErrorRequestHandler = (err, req, res, next) => {
        if (res.headersSent) {
            next(err);
            return;
        }

        const isApiError = err instanceof ApiError;
        const status = err.status ?? 500;
        const message = isApiError ? err.message : "Error inesperado";
        const code = isApiError ? err.code : undefined;
        res.status(status).json({ code, message });
    };
}
