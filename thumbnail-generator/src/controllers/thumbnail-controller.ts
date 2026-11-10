import type {
    CreateThumbnailHandler,
    ThumbnailControllerDependencies
} from "../types/thumbnail/thumbnail-controller.js";

/**
 * Thumbnail controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class ThumbnailController {
    private readonly thumbnailService: ThumbnailControllerDependencies["thumbnailService"];

    constructor({ thumbnailService }: ThumbnailControllerDependencies) {
        this.thumbnailService = thumbnailService;
    }

    create: CreateThumbnailHandler = async (req, res) => {
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
