import PostgresClient from "../../config/db/postgres-client.js";
import refreshTokensColumns from "./refresh-tokens-columns.js";

/**
 * Refresh tokens table model
 *
 * @author HattoriHanzo-Ronin
 */
export default class RefreshTokensModel {
    /**
     * Gets a refresh token
     *
     * @param {string} params.token Refresh token
     * @returns {Promise<{ user_id: string, token: string } | null>} Refresh token
     */
    static async getByToken({ token }) {
        return client.oneOrNone("select * from refresh_tokens where token = encode(digest($1, 'sha256'),'hex')", [
            token
        ]);
    }

    /**
     * Inserts a refresh token
     *
     * @param {Object} params.refreshToken Refresh token data
     * @returns {Promise<void>}
     */
    static async insert({ refreshToken }) {
        return client.none(helpers().insert(refreshToken, insertColumns));
    }

    /**
     * Deletes a refresh token
     *
     * @param {string} params.token Refresh token
     * @returns {Promise<void>}
     */
    static async delete({ token }) {
        return client.none("delete from refresh_tokens WHERE token = encode(digest($1, 'sha256'),'hex')", [token]);
    }
}

const { getClient, helpers } = PostgresClient;
const client = getClient();
const { insert: insertColumns } = refreshTokensColumns;
