import PostgresClient from "../../../../utils/connection/postgres/postgres-client.js";
import REFRESH_TOKENS_COLUMNS from "./columns.js";
import type { InsertRefreshTokenParams, RefreshToken, RefreshTokenParams } from "../../../../types/refresh-tokens/refresh-tokens-model.js";

/**
 * Default PostgreSQL refresh tokens model
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultRefreshTokensModel {
    private static readonly CLIENT = PostgresClient.getClient();

    static async getByToken({ token }: RefreshTokenParams): Promise<RefreshToken | null> {
        return DefaultRefreshTokensModel.CLIENT.oneOrNone<RefreshToken>(
            "select * from refresh_tokens where token = encode(digest($1, 'sha256'),'hex')",
            [token]
        );
    }

    static async insert({ refreshToken }: InsertRefreshTokenParams): Promise<null> {
        return DefaultRefreshTokensModel.CLIENT.none(PostgresClient.helpers().insert(refreshToken, REFRESH_TOKENS_COLUMNS.insert));
    }

    static async delete({ token }: RefreshTokenParams): Promise<null> {
        return DefaultRefreshTokensModel.CLIENT.none(
            "delete from refresh_tokens WHERE token = encode(digest($1, 'sha256'),'hex')",
            [token]
        );
    }
}
