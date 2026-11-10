import type { CreateThumbnailParams } from "../types/thumbnail/thumbnail-service.js";

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
     * @param [params.signal] Request cancellation signal
     * @returns JPEG thumbnail
     */
    create(params: CreateThumbnailParams): Promise<Buffer>;
}
