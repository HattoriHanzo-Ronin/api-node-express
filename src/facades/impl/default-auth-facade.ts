import type AuthFacade from "../auth-facade.js";
import type { AuthFacadeDependencies } from "../../types/auth/default-auth-facade.js";
import type { AuthRefreshParams, AuthSession } from "../../types/auth/auth-facade.js";
import type { UserCredentials } from "../../types/users/users-model.js";
import type { MappedUserIdentity } from "../../types/users/users-mapper.js";
import ApiError from "../../utils/error/api-error.js";
import { API_ERROR } from "../../config/errors.js";
import { LOG_EVENT } from "../../config/log-events.js";
import Logger from "../../utils/logger/logger.js";

const { authLoginSucceeded, authRefreshSucceeded, authRefreshFailed, authLogoutSucceeded } = LOG_EVENT;

/**
 * Default authentication facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultAuthFacade implements AuthFacade {
    private static readonly LOGGER = Logger.getLogger(DefaultAuthFacade);

    constructor(private readonly dependencies: AuthFacadeDependencies) {}

    async login({ username, password }: UserCredentials) {
        const session = await this.createPayload(
            await this.dependencies.usersFacade.authenticate({ username, password })
        );
        DefaultAuthFacade.LOGGER.info({
            event: authLoginSucceeded,
            message: "Login succeeded",
            context: `User: ${session.user.id}`
        });
        return session;
    }

    async refresh({ refreshToken }: AuthRefreshParams) {
        try {
            await this.dependencies.refreshTokensService.getByToken({ token: refreshToken });
            const { id } = this.dependencies.refreshTokenProvider.verify({ token: refreshToken });
            const user = await this.dependencies.usersFacade.getById({ id });
            await this.dependencies.refreshTokensService.delete({ token: refreshToken });
            return this.createPayload(user).then((session) => {
                DefaultAuthFacade.LOGGER.info({
                    event: authRefreshSucceeded,
                    message: "Token refresh succeeded",
                    context: `User: ${id}`
                });
                return session;
            });
        } catch (err) {
            DefaultAuthFacade.LOGGER.info({ event: authRefreshFailed, message: "Token refresh failed" });
            if (err instanceof ApiError && err.code === API_ERROR.invalidToken) {
                await this.dependencies.refreshTokensService.delete({ token: refreshToken });
            }

            throw err;
        }
    }

    async logout({ refreshToken }: AuthRefreshParams) {
        const result = await this.dependencies.refreshTokensService.delete({ token: refreshToken });
        DefaultAuthFacade.LOGGER.info({ event: authLogoutSucceeded, message: "Logout succeeded" });
        return result;
    }

    private async createPayload({ id, username, roles, scope }: MappedUserIdentity): Promise<AuthSession> {
        const refreshToken = this.dependencies.refreshTokenProvider.create({ payload: { id } });
        await this.dependencies.refreshTokensService.create({ userId: id, token: refreshToken });
        return {
            user: { id, username, roles, scope },
            accessToken: this.dependencies.accessTokenProvider.create({ payload: { id, roles, scope } }),
            refreshToken
        };
    }
}
