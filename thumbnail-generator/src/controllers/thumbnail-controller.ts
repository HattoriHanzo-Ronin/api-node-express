import type {
    CreateThumbnailHandler,
    RegisterThumbnailBatchHandler,
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
        const header = req.get("X-Thumbnail-Batch-Id");
        const batchId = header && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(header) ? header : undefined;
        const thumbnail = await this.thumbnailService.create({ id: req.params.id, batchId, signal: controller.signal });
        if (res.writableEnded) {
            return;
        }

        res.type("jpeg").send(thumbnail);
    };

    registerBatch: RegisterThumbnailBatchHandler = (req, res) => {
        this.thumbnailService.registerBatch(req.body);
        res.sendStatus(204);
    };
}
