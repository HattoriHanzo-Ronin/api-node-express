import type { ThumbnailController } from "../thumbnail-controller.js";
import type { ThumbnailService } from "../../services/thumbnail-service.js";
import type { ExpressThumbnailControllerHandlers } from "../../types/default-thumbnail-controller.js";

/**
 * Thumbnail controller
 *
 * @author HattoriHanzo-Ronin
 */
export class DefaultThumbnailController implements ThumbnailController<ExpressThumbnailControllerHandlers> {
    private readonly thumbnailService: ThumbnailService;

    constructor({ thumbnailService }: { thumbnailService: ThumbnailService }) {
        this.thumbnailService = thumbnailService;
    }

    create: ThumbnailController<ExpressThumbnailControllerHandlers>["create"] = async (req, res) => {
        const controller = new AbortController();
        res.once("close", () => {
            if (!res.writableEnded) {
                controller.abort();
            }
        });
        const thumbnail = await this.thumbnailService.create({ id: req.params.id, signal: controller.signal });
        if (res.writableEnded) {
            return;
        }

        res.type("jpeg").send(thumbnail);
    };
}
