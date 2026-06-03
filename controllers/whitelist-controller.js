import { allowDeviceSchema, routerSchema } from "../schemas/whitelist-schema.js";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * Whitelist controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class WhitelistController {
    constructor({ whitelistService }) {
        this.whitelistService = whitelistService;
    }

    create = async (req, res, next) => {
        const body = validateBody(req.body);
        const result = await this.whitelistService.create(body);
        res.json(result);
    };

    delete = async (req, res, next) => {
        const body = validateBody(req.body);
        const result = await this.whitelistService.delete(body);
        res.json(result);
    };
}

const { validateData } = ValidateUtils;

function validateBody(body) {
    const { router, allowDevice } = body;
    return { router: validateData(router, routerSchema), allowDevice: validateData(allowDevice, allowDeviceSchema) };
}
