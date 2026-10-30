import type { RequestHandler } from "express";
import type { ThumbnailController } from "../thumbnail-controller.js";
import type { ThumbnailService } from "../../services/thumbnail-service.js";

/**
 * Thumbnail controller
 *
 * @author HattoriHanzo-Ronin
 */
export class DefaultThumbnailController implements ThumbnailController {
    private readonly thumbnailService;

    constructor({ thumbnailService }: { thumbnailService: ThumbnailService }) {
        this.thumbnailService = thumbnailService;
    }

    create: RequestHandler<{ id: string }> = async (req, res) => {
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
