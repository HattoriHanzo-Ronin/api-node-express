import type { InsertRefreshTokenParams, RefreshToken, RefreshTokenParams } from "../types/refresh-tokens/refresh-tokens-model.js";

export default interface RefreshTokensModel {
    /**
     * Returns a refresh token
     *
     * @param params.token Refresh token
     * @returns Refresh token or null
     */
    getByToken(params: RefreshTokenParams): Promise<RefreshToken | null>;

    /**
     * Inserts a refresh token
     *
     * @param params.refreshToken Refresh token data
     * @returns Insertion result
     */
    insert(params: InsertRefreshTokenParams): Promise<null>;

    /**
     * Deletes a refresh token
     *
     * @param params.token Refresh token
     * @returns Deletion result
     */
    delete(params: RefreshTokenParams): Promise<null>;
}
