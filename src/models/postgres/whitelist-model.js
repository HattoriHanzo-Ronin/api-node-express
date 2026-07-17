import PostgresClient from "../../config/db/postgres-client.js";
import whitelistColumns from "./whitelist-columns.js";

/**
 * Whitelist table model
 *
 * @author HattoriHanzo-Ronin
 */
export default class WhitelistModel {
    /**
     * Retrieves router whitelist keys
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<{ key: string | null }[]>} Router whitelist keys
     */
    static async getKeys({ routerId }) {
        return client.any(`select key from whitelist where router_id = $1`, [routerId]);
    }

    /**
     * Inserts a whitelist entry
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {Object} params.whitelist Whitelist entry
     */
    static async insert({ clientTx, whitelist }) {
        return clientTx.none(helpers().insert(whitelist, insertColumns));
    }

    /**
     * Deletes a whitelist entry
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {string} params.routerId Router identifier
     * @param {string} params.mac Connection MAC address
     * @returns {Promise<{ key: string | null } | null>} Deleted whitelist entry
     */
    static async delete({ clientTx, routerId, mac }) {
        return clientTx.oneOrNone(
            `delete from whitelist where router_id = $1 and connection_mac = $2 returning key`,
            [routerId, mac]
        );
    }
}

const { getClient, helpers } = PostgresClient;
const client = getClient();
const { insert: insertColumns } = whitelistColumns;
