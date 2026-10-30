import express from "express";
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { API_ERROR } from "../config/errors.js";
import ApiError from "../utils/error/api-error.js";

const { internalError, routeNotFound } = API_ERROR;

/**
 * Application middleware factory
 *
 * @author HattoriHanzo-Ronin
 */
export default class Middlewares {
    /**
     * Creates JSON body parser middleware
     *
     * @returns JSON body parser middleware
     */
    static json(): RequestHandler {
        return express.json();
    }

    /**
     * Wraps an async Express handler and forwards errors to the next middleware
     *
     * @param fn Async Express route handler
     * @returns Express middleware
     */
    static asyncHandler<Params, ResBody, ReqBody, ReqQuery>(
        fn: RequestHandler<Params, ResBody, ReqBody, ReqQuery>
    ): RequestHandler<Params, ResBody, ReqBody, ReqQuery> {
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
        next(new ApiError({ message: "Page not found", status: 404, apiError: routeNotFound }));
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

        const status = err.status ?? 500;
        const isApiError = err instanceof ApiError;
        const message = isApiError ? err.message : "Error inesperado";
        const code = isApiError ? err.code : internalError;
        res.status(status).json({ code, message });
    };
}
