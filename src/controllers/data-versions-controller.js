import { dataVersionsSchema } from "../schemas/data-versions-schema.js";
import dirSchema from "../schemas/common/dir-schema.js";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * Data versions controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class DataVersionsController {
    constructor({ dataVersionsFacade }) {
        this.dataVersionsFacade = dataVersionsFacade;
    }

    /**
     * Returns a data version by its resource identifier
     *
     * @param {Object} req HTTP request
     * @param {Object} res HTTP response
     */
    getById = async (req, res) => {
        const { id } = validateData(req.query, dataVersionsSchema);
        res.json(await this.dataVersionsFacade.getById({ id }));
    };

    /**
     * Returns a FTP directory version
     *
     * @param {Object} req HTTP request
     * @param {Object} res HTTP response
     */
    getFtp = async (req, res) => {
        const { query, user: authUser } = req;
        const { dir } = validateData(query, dirSchema);
        res.json(await this.dataVersionsFacade.getFtp({ dir, authUser }));
    };
}

const { validateData } = ValidateUtils;
