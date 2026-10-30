import type { CreateThumbnailParams } from "../types/thumbnail-service.js";

/**
 * Thumbnail service contract
 *
 * @author HattoriHanzo-Ronin
 */
export interface ThumbnailService {
    /**
     * Creates a JPEG thumbnail from a media session
     *
     * @param params.id Media session identifier
     * @param [params.signal] Request cancellation signal
     * @returns JPEG thumbnail
     */
    create(params: CreateThumbnailParams): Promise<Buffer>;
}
