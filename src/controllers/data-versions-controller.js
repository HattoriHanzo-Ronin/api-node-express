import { dataVersionsSchema } from "../schemas/data-versions-schema.js";
import dirSchema from "../schemas/common/dir-schema.js";
import ZodUtils from "../utils/zod-utils.js";
const { validateData } = ZodUtils;

/**
 * Data versions controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class DataVersionsController {
    constructor({ dataVersionsFacade }) {
        this.dataVersionsFacade = dataVersionsFacade;
    }

    getById = async (req, res) => {
        const { id } = validateData(req.query, dataVersionsSchema);
        res.json(await this.dataVersionsFacade.getById({ id }));
    };

    getFtp = async (req, res) => {
        const { query, user: authUser } = req;
        const { dir } = validateData(query, dirSchema);
        res.json(await this.dataVersionsFacade.getFtp({ dir, authUser }));
    };
}
