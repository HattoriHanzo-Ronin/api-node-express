import type AuthFacade from "../auth-facade.js";
import type { AuthFacadeDependencies } from "../../types/default-auth-facade.js";
import type { AuthRefreshParams, AuthSession } from "../../types/auth-facade.js";
import type { UserCredentials } from "../../types/users-model.js";
import type { AuthenticatedUserResponse } from "../../types/users-facade.js";
import ApiError from "../../utils/error/api-error.js";
import { API_ERROR } from "../../config/errors.js";

/**
 * Default authentication facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultAuthFacade implements AuthFacade {
    constructor(private readonly dependencies: AuthFacadeDependencies) {}

    async login({ username, password }: UserCredentials) {
        return this.createPayload(await this.dependencies.usersFacade.authenticate({ username, password }));
    }

    async refresh({ refreshToken }: AuthRefreshParams) {
        try {
            await this.dependencies.refreshTokensService.getByToken({ token: refreshToken });
            const { id } = this.dependencies.refreshTokenProvider.verify({ token: refreshToken });
            const user = await this.dependencies.usersFacade.getById({ id });
            await this.dependencies.refreshTokensService.delete({ token: refreshToken });
            return this.createPayload(user);
        } catch (err) {
            if (err instanceof ApiError && err.code === API_ERROR.invalidToken) {
                await this.dependencies.refreshTokensService.delete({ token: refreshToken });
            }

            throw err;
        }
    }

    async logout({ refreshToken }: AuthRefreshParams) {
        return this.dependencies.refreshTokensService.delete({ token: refreshToken });
    }

    private async createPayload({ id, username, roles, scope }: AuthenticatedUserResponse): Promise<AuthSession> {
        const refreshToken = this.dependencies.refreshTokenProvider.create({ payload: { id } });
        await this.dependencies.refreshTokensService.create({ userId: id, token: refreshToken });
        return {
            user: { id, username, roles, scope },
            accessToken: this.dependencies.accessTokenProvider.create({ payload: { id, roles, scope } }),
            refreshToken
        };
    }
}
