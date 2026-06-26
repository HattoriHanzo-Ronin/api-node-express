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
            `select ${columnsWithAlias(allowedInfoColumns, "d")} from devices d 
             join whitelist w on w.allowed_device_id = d.id 
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
            `select ${columnsWithAlias(allowedInfoColumns, "d")} from devices d 
             left join whitelist w on w.allowed_device_id = d.id and w.router_id = $1
             where w.allowed_device_id is null`,
            [routerId]
        );
    }

    /**
     * Retrieves routers associated with an allowed device
     *
     * @param {string} params.allowedDeviceId Allowed device identifier
     * @returns {Promise<Object[]>} List of associated routers
     */
    static async getRoutersByAllowedDevice({ allowedDeviceId }) {
        return client.any(
            `select ${columnsWithAlias(routerInfoColumns, "d")}, w.key from whitelist w
             join devices d on d.id = w.router_id where w.allowed_device_id = $1`,
            [allowedDeviceId]
        );
    }

    /**
     * Checks whether an IP address is already assigned to one of the specified device types.
     *
     * @param {Object} params
     * @param {string[]} params.types Device types to search
     * @param {string} params.ip IP address
     * @param {string | null} params.id Device identifier to exclude
     * @returns {Promise<boolean>} Whether the IP address already exists
     */
    static async existsIpByTypes({ types, ip, id }) {
        const { exists } = await client.one(
            `select exists ( select 1 from devices where ip = $1 and type in ($2:list) 
             and ($3 is null or id <> $3) )`,
            [ip, types, id]
        );
        return exists;
    }

    /**
     * Inserts a device
     *
     * @param {Object} params.device Device data
     * @returns {Promise<Object>} Inserted device
     */
    static async insert({ device }) {
        return client.one(helpers().insert(device, insertColumns) + " returning *");
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
    allowedInfo: allowedInfoColumns,
    routerInfo: routerInfoColumns
} = devicesColumns;
const { pgPromiseColumnsWithAlias: columnsWithAlias } = DbUtils;
