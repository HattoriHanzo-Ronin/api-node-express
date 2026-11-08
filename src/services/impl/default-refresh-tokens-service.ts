import type RefreshTokensService from "../refresh-tokens-service.js";
import type { RefreshTokensServiceDependencies } from "../../types/refresh-tokens/default-refresh-tokens-service.js";
import type { RefreshTokenParams } from "../../types/refresh-tokens/refresh-tokens-model.js";
import type { CreateRefreshTokenParams } from "../../types/refresh-tokens/refresh-tokens-service.js";
import type { PostgresError } from "../../types/utils/postgres-error.js";
import ApiError from "../../utils/error/api-error.js";
import { API_ERROR } from "../../config/errors.js";

/**
 * Default refresh tokens service
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultRefreshTokensService implements RefreshTokensService {
    constructor(private readonly dependencies: RefreshTokensServiceDependencies) {}

    async getByToken({ token }: RefreshTokenParams) {
        const result = await this.dependencies.refreshTokensModel.getByToken({ token });
        ApiError.handle([
            { condition: !result, message: "Token no válido", status: 401, apiError: API_ERROR.invalidToken }
        ]);
    }

    async create({ userId, token }: CreateRefreshTokenParams) {
        try {
            await this.dependencies.refreshTokensModel.insert({ refreshToken: { user_id: userId, token } });
        } catch (err) {
            this.dependencies.entityError(err as PostgresError);
            throw err;
        }
    }

    async delete({ token }: RefreshTokenParams) {
        return this.dependencies.refreshTokensModel.delete({ token });
    }
}
