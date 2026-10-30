import type { RequestHandler } from "express";

export interface ThumbnailController {
    create: RequestHandler<{ id: string }>;
}
