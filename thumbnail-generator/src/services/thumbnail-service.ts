import type { CreateThumbnailParams } from "../types/thumbnail-service.js";

export interface ThumbnailService {
    /**
     * Queues a JPEG thumbnail from a temporary media session
     */
    create(params: CreateThumbnailParams): Promise<Buffer>;
}
