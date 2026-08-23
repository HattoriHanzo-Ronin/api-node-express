import { dataVersionsSchema } from "../schemas/data-versions-schema.js";
import ValidateUtils from "../utils/validate-utils.js";

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
        const { id } = validateData(req.query, dataVersionsSchema);
        res.json(await this.dataVersionsService.getById({ id }));
    };
}

const { validateData } = ValidateUtils;
