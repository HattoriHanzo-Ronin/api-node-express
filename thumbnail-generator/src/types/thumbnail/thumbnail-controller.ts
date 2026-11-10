import type { RequestHandler } from "express";
import type ThumbnailService from "../../services/thumbnail-service.js";

export type ThumbnailControllerDependencies = { thumbnailService: ThumbnailService };
export type CreateThumbnailHandler = RequestHandler<{ id: string }>;
