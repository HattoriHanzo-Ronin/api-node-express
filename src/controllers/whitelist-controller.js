import idSchema from "../schemas/common/id-schema.js";
import allowedDeviceSchema from "../schemas/whitelist-schema.js";
import ZodUtils from "../utils/zod-utils.js";

const { validateData } = ZodUtils;

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
        const whitelist = this.#validateRequest(req);
        res.json(await this.whitelistFacade.create(whitelist));
    };

    delete = async (req, res) => {
        const whitelist = this.#validateRequest(req);
        res.json(await this.whitelistFacade.delete(whitelist));
    };

    #validateRequest({ params, body }) {
        const { id: routerId } = validateData(params, idSchema);
        return { routerId, allowedDevice: validateData(body, allowedDeviceSchema) };
    }
}
