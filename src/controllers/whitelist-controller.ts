import type {
    WhitelistControllerDependencies,
    WhitelistHandler,
    WhitelistRequest
} from "../types/whitelist/whitelist-controller.js";
import type { WhitelistParams } from "../types/whitelist/whitelist-facade.js";
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
    private readonly whitelistFacade: WhitelistControllerDependencies["whitelistFacade"];

    constructor({ whitelistFacade }: WhitelistControllerDependencies) {
        this.whitelistFacade = whitelistFacade;
    }

    create: WhitelistHandler = async (req, res) => {
        const whitelist = this.validateRequest(req);
        res.json(await this.whitelistFacade.create(whitelist));
    };

    delete: WhitelistHandler = async (req, res) => {
        const whitelist = this.validateRequest(req);
        res.json(await this.whitelistFacade.delete(whitelist));
    };

    private validateRequest({ params, body }: WhitelistRequest): WhitelistParams {
        const { id: routerId } = validateData(params, idSchema);
        return { routerId, allowedDevice: validateData(body, allowedDeviceSchema) };
    }
}
