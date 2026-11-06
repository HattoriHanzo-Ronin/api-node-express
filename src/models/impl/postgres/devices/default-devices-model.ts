import type { ITask } from "pg-promise";
import type { AllowedDevice, AllowedDeviceIdParams, Device, DeviceId, InsertDeviceParams, RouterAllowedDevice, RouterIdParams, UpdateDeviceParams } from "../../../../types/devices-model.js";
import PostgresClient from "../../../../utils/connection/postgres/postgres-client.js";
import PostgresDbUtils from "../../../../utils/postgres-db-utils.js";
import devicesColumns from "./columns.js";

const { insert, update, allowedInfo, routerInfo } = devicesColumns;
const { columnsWithAlias } = PostgresDbUtils;

/**
 * Default PostgreSQL devices model
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultDevicesModel {
    private static readonly CLIENT = PostgresClient.getClient();

    static async getAll() {
        return DefaultDevicesModel.CLIENT.any<Device>(`select * from devices`);
    }

    static async getById({ id }: DeviceId) {
        return DefaultDevicesModel.CLIENT.oneOrNone<Device>("select * from devices where id = $1", [id]);
    }

    static async getAllowedDevices({ routerId }: RouterIdParams) {
        return DefaultDevicesModel.CLIENT.any<AllowedDevice>(
            `select ${columnsWithAlias(allowedInfo, "d")}, c.ctype, c.mac
             from devices d
             join connections c on c.device_id = d.id
             join whitelist w on c.mac = w.connection_mac
             where w.router_id = $1`,
            [routerId]
        );
    }

    static async getNotAllowedDevices({ routerId }: RouterIdParams) {
        return DefaultDevicesModel.CLIENT.any<AllowedDevice>(
            `select ${columnsWithAlias(allowedInfo, "d")}, c.ctype, c.mac
             from devices d
             join connections c on c.device_id = d.id
             left join whitelist w on c.mac = w.connection_mac and w.router_id = $1
             where w.connection_mac is null`,
            [routerId]
        );
    }

    static async getRoutersByAllowedDevice({ allowedDeviceId }: AllowedDeviceIdParams) {
        return DefaultDevicesModel.CLIENT.any<RouterAllowedDevice>(
            `select ${columnsWithAlias(routerInfo, "d")}, c.ctype, c.mac, w.key
             from devices d
             join whitelist w on w.router_id = d.id
             join connections c on c.mac = w.connection_mac
             where c.device_id = $1`,
            [allowedDeviceId]
        );
    }

    static async insert({ clientTx, device }: InsertDeviceParams<ITask<unknown>>) {
        return clientTx.one<Device>(PostgresClient.helpers().insert(device, insert) + " returning *");
    }

    static async update({ clientTx, id, data }: UpdateDeviceParams<ITask<unknown>>) {
        return clientTx.oneOrNone<Device>(PostgresClient.helpers().update(data, update) + " where id = $1 returning *", [id]);
    }

    static async delete({ id }: DeviceId) {
        return DefaultDevicesModel.CLIENT.oneOrNone<DeviceId>("delete from devices where id = $1 returning id", [id]);
    }
}
