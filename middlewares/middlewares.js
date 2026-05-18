import express from "express";
import cors from "cors";
import multer from "multer";

/**
 * Application middleware factory.
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
     * Wraps an async Express handler and forwards errors to the next middleware.
     *
     * @param {Function} fn Async Express route handler
     * @returns {Function} Express middleware
     */
    static asyncHandler(fn) {
        return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
    }
}
