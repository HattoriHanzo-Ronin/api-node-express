import type { RefreshTokenParams } from "../types/refresh-tokens/refresh-tokens-model.js";
import type { CreateRefreshTokenParams } from "../types/refresh-tokens/refresh-tokens-service.js";

export default interface RefreshTokensService {
    /**
     * Validates a refresh token
     *
     * @param params.token Refresh token
     */
    getByToken(params: RefreshTokenParams): Promise<void>;

    /**
     * Creates a refresh token
     *
     * @param params.userId User identifier
     * @param params.token Refresh token
     */
    create(params: CreateRefreshTokenParams): Promise<void>;

    /**
     * Deletes a refresh token
     *
     * @param params.token Refresh token
     * @returns Deletion result
     */
    delete(params: RefreshTokenParams): Promise<null>;
}
