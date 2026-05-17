import express from "express";
import cors from "cors";
import multer from "multer";

/**
 * Contains application middleware configurations and factory methods
 *
 * @author HattoriHanzo-Ronin
 */
export default class Middlewares {
    /**
     * Creates a CORS middleware with optional allowed origins
     *
     */
    static cors = (acceptOrigins) =>
        cors({
            origin: (origin, callback) => {
                if (acceptOrigins) {
                    if (acceptOrigins.includes(origin)) return callback(null, true);
                    return callback(new Error("No permitido"));
                }
                return callback(null, true);
            }
        });

    /**
     * Creates a JSON body parser middleware
     *
     */
    static json = () => express.json();

    /**
     * Creates a Multer middleware using memory storage
     *
     */
    static mult = () => multer({ storage: multer.memoryStorage() });
}
