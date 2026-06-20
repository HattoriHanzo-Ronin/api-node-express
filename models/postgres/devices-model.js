import PostgresClient from "../../config/db/postgres-client.js";
import DbUtils from "../../utils/db-utils.js";
import devicesColumns from "./devices-columns.js";

/**
 * Devices table model
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesModel {
    /**
     * Retrieves devices
     *
     * @returns {Promise<Object[]>} List of devices
     */
    static async getAll() {
        return client.any(`select * from devices`);
    }

    /**
     * Retrieves a device by identifier
     *
     * @param {string} params.id Device identifier
     * @returns {Promise<Object | null>} Device data
     */
    static async getById({ id }) {
        return client.oneOrNone("select * from devices where id = $1", [id]);
    }

    /**
     * Retrieves allowed devices
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<Object[]>} List of allowed devices
     */
    static async getAllowedDevices({ routerId }) {
        return client.any(
            `select ${columnsWithAlias(basicInfoColumns, "d")} from devices d 
             join whitelist w on w.allow_device_id = d.id 
             where w.router_id = $1`,
            [routerId]
        );
    }

    /**
     * Retrieves devices not allowed on a router
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<Object[]>} List of devices not allowed on the router
     */
    static async getNotAllowedDevices({ routerId }) {
        return client.any(
            `select ${columnsWithAlias(basicInfoColumns, "d")} from devices d 
             left join whitelist w on w.allow_device_id = d.id and w.router_id = $1
             where w.allow_device_id is null`,
            [routerId]
        );
    }

    /**
     * Retrieves routers associated with an allowed device
     *
     * @param {string} params.allowDeviceId Allowed device identifier
     * @returns {Promise<Object[]>} List of associated routers
     */
    static async getRoutersByAllowDevice({ allowDeviceId }) {
        return client.any(
            `select ${columnsWithAlias(basicRouterInfoColumns, "d")}, w.key from whitelist w
                join devices d on d.id = w.router_id where w.allow_device_id = $1`,
            [allowDeviceId]
        );
    }

    /**
     * Inserts a device
     *
     * @param {Object} params.device Device data
     * @returns {Promise<{ id: string }>} Inserted device identifier
     */
    static async insert({ device }) {
        return client.one(helpers().insert(device, insertColumns) + " returning id");
    }

    /**
     * Updates a device
     *
     * @param {import("pg-promise").IDatabase<any>} params.clientTx Database transaction
     * @param {string} params.id Device identifier
     * @param {Object} params.data Device data
     * @returns {Promise<{ id: string, name: string, mac: string } | null>} Updated device
     */
    static async update({ clientTx, id, data }) {
        return clientTx.oneOrNone(helpers().update(data, updateColumns) + " where id = $1 returning id, name, mac", [
            id
        ]);
    }

    /**
     * Deletes a device
     *
     * @param {string} params.id Device identifier
     * @returns {Promise<{ id: string } | null>} Deleted device identifier
     */
    static async delete({ id }) {
        return client.oneOrNone("delete from devices where id = $1 returning id", [id]);
    }
}

const { getClient, helpers } = PostgresClient;
const client = getClient();
const {
    insert: insertColumns,
    update: updateColumns,
    basicInfo: basicInfoColumns,
    basicRouterInfo: basicRouterInfoColumns
} = devicesColumns;
const { pgPromiseColumnsWithAlias: columnsWithAlias } = DbUtils;
