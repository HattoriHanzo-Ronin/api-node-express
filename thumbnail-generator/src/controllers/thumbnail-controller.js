/**
 * Thumbnail controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class ThumbnailController {
    constructor({ thumbnailService }) {
        this.thumbnailService = thumbnailService;
    }

    /**
     * Creates a JPEG thumbnail from a temporary media session
     *
     * @param {import("express").Request} req HTTP request
     * @param {import("express").Response} res HTTP response
     */
    create = async (req, res) => {
        const thumbnail = await this.thumbnailService.create(req.params.id);
        res.type("jpeg").send(thumbnail);
    };
}
