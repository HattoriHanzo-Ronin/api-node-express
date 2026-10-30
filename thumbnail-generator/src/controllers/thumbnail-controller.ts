import type { RequestHandler } from "express";

/**
 * Thumbnail controller contract
 *
 * @author HattoriHanzo-Ronin
 */
export interface ThumbnailController {
    /**
     * Creates a thumbnail response
     *
     * @param req Express request containing the media session identifier
     * @param res Express response for the JPEG thumbnail
     * @param next Express next function
     */
    create: RequestHandler<{ id: string }>;
}
