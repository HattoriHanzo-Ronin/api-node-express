/**
 * Thumbnail controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class ThumbnailController {
    #thumbnailService;

    constructor({ thumbnailService }) {
        this.#thumbnailService = thumbnailService;
    }

    create = async (req, res) => {
        const controller = new AbortController();
        res.once("close", () => {
            if (!res.writableEnded) {
                controller.abort();
            }
        });
        const thumbnail = await this.#thumbnailService.create({ id: req.params.id, signal: controller.signal });
        if (res.writableEnded) {
            return;
        }

        res.type("jpeg").send(thumbnail);
    };
}
