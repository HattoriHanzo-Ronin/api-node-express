import PostgresClient from "../../config/db/postgres-client.js";
import connectionsColumns from "./connections-columns.js";

/**
 * Connections table model
 *
 * @author HattoriHanzo-Ronin
 */
export default class ConnectionsModel {
    /**
     * Returns the connections associated with multiple devices
     *
     * @param {string[]} params.devicesId Device identifiers
     * @returns {Promise<Object[]>} Connections
     */
    static getByDevices({ devicesId }) {
        return client.any(`select * from connections where device_id in ($1:list)`, [devicesId]);
    }

    /**
     * Inserts multiple connections
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {Object[]} params.connections Connections
     * @returns {Promise<Object[]>} Inserted connections
     */
    static insertMany({ clientTx, connections }) {
        return clientTx.many(helpers().insert(connections, insertColumns) + " returning *");
    }

    /**
     * Updates multiple connections
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {Object[]} params.connections Connections
     * @returns {Promise<Object[]>} Updated connections
     */
    static updateMany({ clientTx, connections }) {
        return clientTx.many(
            helpers().update(connections, insertColumns) +
                ` where t.device_id = v.device_id::uuid and t.ctype = v.ctype::connection_ctype_enum 
                  returning t.*`
        );
    }

    /**
     * Deletes multiple connections
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {string[]} params.macs Connection MAC addresses
     * @returns {Promise<Object[]>} Deleted connections
     */
    static deleteMany({ clientTx, macs }) {
        return clientTx.many("delete from connections where mac in ($1:list) returning *", [macs]);
    }
}

const { getClient, helpers } = PostgresClient;
const client = getClient();
const { insert: insertColumns } = connectionsColumns;
