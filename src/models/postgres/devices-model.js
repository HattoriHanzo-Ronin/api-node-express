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
     * Returns all devices
     *
     * @returns {Promise<Object[]>} Devices
     */
    static async getAll() {
        return client.any(`select * from devices`);
    }

    /**
     * Returns a device by its identifier
     *
     * @param {string} params.id Device identifier
     * @returns {Promise<Object | null>} Device
     */
    static async getById({ id }) {
        return client.oneOrNone("select * from devices where id = $1", [id]);
    }

    /**
     * Returns the devices allowed on a router
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<Object[]>} Allowed devices
     */
    static async getAllowedDevices({ routerId }) {
        return client.any(
            `select ${columnsWithAlias(allowedInfoColumns, "d")}, c.ctype, c.mac 
             from devices d 
             join connections c on c.device_id = d.id
             join whitelist w on c.mac = w.connection_mac
             where w.router_id = $1`,
            [routerId]
        );
    }

    /**
     * Returns the devices not allowed on a router
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<Object[]>} Devices not allowed on the router
     */
    static async getNotAllowedDevices({ routerId }) {
        return client.any(
            `select ${columnsWithAlias(allowedInfoColumns, "d")}, c.ctype, c.mac 
             from devices d 
             join connections c on c.device_id = d.id
             left join whitelist w on c.mac = w.connection_mac and w.router_id = $1
             where w.connection_mac is null`,
            [routerId]
        );
    }

    /**
     * Returns the routers associated with an allowed device
     *
     * @param {string} params.allowedDeviceId Allowed device identifier
     * @returns {Promise<Object[]>} Associated routers
     */
    static async getRoutersByAllowedDevice({ allowedDeviceId }) {
        return client.any(
            `select ${columnsWithAlias(routerInfoColumns, "d")}, c.ctype, c.mac, w.key 
             from devices d
             join whitelist w on w.router_id = d.id
             join connections c on c.mac = w.connection_mac
             where c.device_id = $1`,
            [allowedDeviceId]
        );
    }

    /**
     * Inserts a device
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {Object} params.device Device data
     * @returns {Promise<Object>} Inserted device
     */
    static async insert({ clientTx, device }) {
        return clientTx.one(helpers().insert(device, insertColumns) + " returning *");
    }

    /**
     * Updates a device
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {string} params.id Device identifier
     * @param {Object} params.data Device data
     * @returns {Promise<Object | null>} Updated device
     */
    static async update({ clientTx, id, data }) {
        return clientTx.oneOrNone(helpers().update(data, updateColumns) + " where id = $1 returning *", [id]);
    }

    /**
     * Deletes a device
     *
     * @param {string} params.id Device identifier
     * @returns {Promise<Object | null>} Deleted device
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
    allowedInfo: allowedInfoColumns,
    routerInfo: routerInfoColumns
} = devicesColumns;
const { pgPromiseColumnsWithAlias: columnsWithAlias } = DbUtils;
