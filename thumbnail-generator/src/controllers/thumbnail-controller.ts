import type { ThumbnailControllerHandlers } from "../types/thumbnail-controller.js";

/**
 * Thumbnail controller contract
 *
 * @author HattoriHanzo-Ronin
 * @typeParam Handlers Handler map used by the concrete HTTP implementation
 */
export interface ThumbnailController<Handlers extends ThumbnailControllerHandlers> {
    /**
     * Creates a thumbnail response
     */
    create: Handlers["create"];
}
