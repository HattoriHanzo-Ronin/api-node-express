import express from "express";
import busboy from "busboy";
import type { Readable } from "node:stream";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import ApiError from "../utils/error/api-error.js";
import { API_ERROR } from "../config/errors.js";
import type { ApiErrorResponse } from "../types/api-error.js";
import type { AuthAccessTokenPayload } from "../types/auth.js";
import type { AsyncRequestHandler, MiddlewareError } from "../types/middlewares.js";
import type TokenProvider from "../utils/token-providers/token-provider.js";
import type { Role } from "../types/user-roles-model.js";

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
     * @returns JSON body parser middleware
     */
    static json(): RequestHandler {
        return express.json();
    }

    /**
     * Creates multipart form-data middleware
     *
     * @returns Multipart form-data middleware
     */
    static multipart(): RequestHandler {
        return (req: Request, res: Response, next: NextFunction): void => {
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

            let fileStream: Readable | undefined;
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
                    fileStream.destroy(error as Error);
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
     * @param fn Asynchronous Express handler
     * @returns Error-forwarding middleware
     */
    static asyncHandler(fn: AsyncRequestHandler): RequestHandler {
        return (req: Request, res: Response, next: NextFunction): void => {
            void Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    /**
     * Handles requests that do not match an application route
     */
    static routeNotFound(req: Request, res: Response, next: NextFunction): void {
        next(new ApiError({ message: "Page not found", status: 404, apiError: routeNotFound }));
    }

    /**
     * Handles application errors
     */
    static errorHandler(err: MiddlewareError, req: Request, res: Response, next: NextFunction): void {
        if (res.headersSent) {
            next(err);
            return;
        }

        const status = err.status || 500;
        const isApiError = err instanceof ApiError;
        const message = isApiError ? err.message : "Error inesperado";
        const code = isApiError ? err.code : internalError;
        let result: ApiErrorResponse = { code, message };
        if (err.details) {
            result = { ...result, details: err.details };
        }

        res.status(status).json(result);
    }

    /**
     * Requires a valid bearer access token
     *
     * @param accessTokenProvider Access token provider
     * @returns Authentication middleware
     */
    static requireAuth({ accessTokenProvider }: { accessTokenProvider: TokenProvider<AuthAccessTokenPayload> }): RequestHandler {
        return (req: Request, res: Response, next: NextFunction): void => {
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
     * @param roles Roles allowed to access the route
     * @returns Authorization middleware
     */
    static authorizedRoles(roles: Role[]): RequestHandler {
        return (req: Request, res: Response, next: NextFunction): void => {
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
