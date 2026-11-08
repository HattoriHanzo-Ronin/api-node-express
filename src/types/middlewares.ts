import type { NextFunction, Request, Response } from "express";
import type { Readable } from "node:stream";
import type ApiError from "../utils/error/api-error.js";
import type { VerifiedAccessToken } from "./auth.js";

export type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

export type MiddlewareError = Error & Partial<Pick<ApiError, "status" | "details">>;

export type UploadedFile = {
    originalname: string;
    mimetype: string;
    stream: Readable;
};

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
    namespace Express {
        interface Request {
            user: VerifiedAccessToken;
            file?: UploadedFile;
        }
    }
}
