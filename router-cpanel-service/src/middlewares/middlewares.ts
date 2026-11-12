import express from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { API_ERROR } from "../config/errors.js";
import { LOG_EVENT } from "../config/log-events.js";
import ApiError from "../utils/error/api-error.js";
import Logger from "../utils/logger/logger.js";
import type { MiddlewareError } from "../types/middlewares/middlewares.js";

const { internalError, routeNotFound } = API_ERROR;

/**
 * Application middleware factory
 *
 * @author HattoriHanzo-Ronin
 */
export default class Middlewares {
    private static readonly LOGGER = Logger.getLogger(Middlewares);

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
        return (req, res, next): void => {
            void Promise.resolve(fn(req, res, next)).catch(next);
        };
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
    static errorHandler(err: MiddlewareError, req: Request, res: Response, next: NextFunction): void {
        const status = err.status ?? 500;
        const isApiError = err instanceof ApiError;
        if (!isApiError) {
            Middlewares.LOGGER.error({
                event: LOG_EVENT.httpRequestFailed,
                message: "Router panel request failed",
                error: err
            });
        }

        if (res.headersSent) {
            next(err);
            return;
        }

        const message = isApiError ? err.message : "Error inesperado";
        const code = isApiError ? err.code : internalError;
        res.status(status).json({ code, message });
    }
}
