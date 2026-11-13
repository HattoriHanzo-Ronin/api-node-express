import type { CreateThumbnailParams, RegisterThumbnailBatchParams } from "../types/thumbnail/thumbnail-service.js";

/**
 * Thumbnail service contract
 *
 * @author HattoriHanzo-Ronin
 */
export default interface ThumbnailService {
    /**
     * Creates a JPEG thumbnail from a media session
     *
     * @param params.id Media session identifier
     * @param [params.batchId] Batch identifier
     * @param [params.signal] Request cancellation signal
     * @returns JPEG thumbnail
     */
    create(params: CreateThumbnailParams): Promise<Buffer>;

    /**
     * Registers a thumbnail batch
     *
     * @param params.id Batch identifier
     * @param params.userId User identifier
     * @param params.files Media identifiers and sizes
     */
    registerBatch(params: RegisterThumbnailBatchParams): void;
}
