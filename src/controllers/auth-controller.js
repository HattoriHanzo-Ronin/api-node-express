import { authLoginSchema, authRefreshTokenSchema } from "../schemas/auth-schema.js";
import ZodUtils from "../utils/zod-utils.js";

const { validateData } = ZodUtils;

/**
 * Controller for Authentication
 *
 * @author HattoriHanzo-Ronin
 */
export default class AuthController {
    #authFacade;

    constructor({ authFacade }) {
        this.#authFacade = authFacade;
    }

    login = async (req, res) => {
        const { username, password } = validateData(req.body, authLoginSchema);
        res.json(await this.#authFacade.login({ username, password }));
    };

    refresh = async (req, res) => {
        const { refreshToken } = validateData(req.body, authRefreshTokenSchema);
        res.json(await this.#authFacade.refresh({ refreshToken }));
    };

    logout = async (req, res) => {
        const { refreshToken } = validateData(req.body, authRefreshTokenSchema);
        await this.#authFacade.logout({ refreshToken });
        res.status(204).end();
    };
}
