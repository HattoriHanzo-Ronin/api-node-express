/**
 * Data versions controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class DataVersionsController {
    constructor({ dataVersionsService }) {
        this.dataVersionsService = dataVersionsService;
    }

    /**
     * Returns a data version by its resource identifier
     *
     * @param {Object} req HTTP request
     * @param {Object} res HTTP response
     */
    getById = async (req, res) => {
        const { id } = req.params;
        res.json(await this.dataVersionsService.getById({ id }));
    };
}
