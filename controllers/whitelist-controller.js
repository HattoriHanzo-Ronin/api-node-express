import idSchema from "../schemas/id-schema.js";
import allowedDeviceSchema from "../schemas/whitelist-schema.js";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * Whitelist controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class WhitelistController {
    constructor({ whitelistFacade }) {
        this.whitelistFacade = whitelistFacade;
    }

    create = async (req, res) => {
        const whitelist = validateRequest(req);
        const result = await this.whitelistFacade.create(whitelist);
        res.json(result);
    };

    delete = async (req, res) => {
        const whitelist = validateRequest(req);
        const result = await this.whitelistFacade.delete(whitelist);
        res.json(result);
    };
}

const { validateData } = ValidateUtils;

function validateRequest({ params, body }) {
    const { id: routerId } = validateData(params, idSchema);
    return { routerId, allowedDevice: validateData(body, allowedDeviceSchema) };
}
