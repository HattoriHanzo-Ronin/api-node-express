import PostgresClient from "../../config/db/postgres-client.js";
import whitelistColumns from "./whitelist-columns.js";

/**
 * Whitelist database model, handles whitelist persistence operations
 *
 * @author HattoriHanzo-Ronin
 */
export default class WhitelistModel {
    /**
     * Retrieves router whitelist keys
     *
     * @param {string} params.router_id Router device identifier
     * @returns {{ key: string }[]} Router whitelist keys
     */
    static async getKeys({ router_id }) {
        return client.any(`select key from whitelist where router_id = $1`, [router_id]);
    }

    /**
     * Inserts a whitelist entry.
     *
     * @param {import("pg-promise").IDatabase<any>} params.clientTx Database transaction
     * @param {Object} params.whitelist Whitelist entry
     * @returns {{ router_id: string, allow_device_id: string }} Inserted whitelist entry
     */
    static async insert({ clientTx, whitelist }) {
        return clientTx.one(helpers().insert(whitelist, insertColumns) + " returning router_id, allow_device_id");
    }

    /**
     * Deletes a whitelist entry
     *
     * @param {import("pg-promise").IDatabase<any>} params.clientTx Database transaction
     * @param {string} params.routerId Router device identifier
     * @param {string} params.allowDeviceId Allowed device identifier
     * @returns {{ router_id: string, allow_device_id: string, key: string | null } | null} Deleted whitelist entry
     */
    static async delete({ clientTx, routerId, allowDeviceId }) {
        return clientTx.oneOrNone(
            `delete from whitelist where router_id = $1 and allow_device_id = $2 
             returning *`,
            [routerId, allowDeviceId]
        );
    }
}

const { getClient, helpers } = PostgresClient;
const client = getClient();
const { insert: insertColumns } = whitelistColumns;
