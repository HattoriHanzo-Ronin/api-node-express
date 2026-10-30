import type { RequestHandler } from "express";

export type ExpressThumbnailControllerHandlers = {
    create: RequestHandler<{ id: string }>;
};
