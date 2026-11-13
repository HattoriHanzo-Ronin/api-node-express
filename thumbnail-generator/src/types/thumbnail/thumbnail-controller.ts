import type { RequestHandler } from "express";
import type ThumbnailService from "../../services/thumbnail-service.js";
import type { RegisterThumbnailBatchParams } from "./thumbnail-service.js";

export type ThumbnailControllerDependencies = { thumbnailService: ThumbnailService };
export type CreateThumbnailHandler = RequestHandler<{ id: string }>;
export type RegisterThumbnailBatchHandler = RequestHandler<
    Record<string, never>,
    unknown,
    RegisterThumbnailBatchParams
>;
