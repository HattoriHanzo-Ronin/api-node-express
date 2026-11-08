import type { AuthControllerDependencies, LoginHandler, LogoutHandler, RefreshHandler } from "../types/auth/auth-controller.js";
import { AUTH_LOGIN_SCHEMA, AUTH_REFRESH_TOKEN_SCHEMA } from "../schemas/auth-schema.js";
import ZodUtils from "../utils/zod-utils.js";

const { validateData } = ZodUtils;

/**
 * Authentication controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class AuthController {
    private readonly authFacade: AuthControllerDependencies["authFacade"];

    constructor({ authFacade }: AuthControllerDependencies) {
        this.authFacade = authFacade;
    }

    login: LoginHandler = async (req, res) => {
        const { username, password } = validateData(req.body, AUTH_LOGIN_SCHEMA);
        res.json(await this.authFacade.login({ username, password }));
    };

    refresh: RefreshHandler = async (req, res) => {
        const { refreshToken } = validateData(req.body, AUTH_REFRESH_TOKEN_SCHEMA);
        res.json(await this.authFacade.refresh({ refreshToken }));
    };

    logout: LogoutHandler = async (req, res) => {
        const { refreshToken } = validateData(req.body, AUTH_REFRESH_TOKEN_SCHEMA);
        await this.authFacade.logout({ refreshToken });
        res.status(204).end();
    };
}
