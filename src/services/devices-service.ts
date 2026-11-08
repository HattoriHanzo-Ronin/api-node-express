import type { GetAllDevicesParams } from "../types/devices/devices-service.js";
import type {
    AllowedDevice, AllowedDeviceIdParams, Device, DeviceId, InsertDeviceParams,
    RouterAllowedDevice, RouterIdParams, UpdateDeviceParams
} from "../types/devices/devices-model.js";

export default interface DevicesService<Transaction> {
    /**
     * Returns all devices
     *
     * @returns Devices
     */
    getAll(params: GetAllDevicesParams): Promise<Device[]>;

    /**
     * Returns a device by identifier
     *
     * @param params.id Device identifier
     * @returns Device
     */
    getById(params: DeviceId): Promise<Device>;

    /**
     * Returns devices allowed on a router
     *
     * @param params.routerId Router identifier
     * @returns Allowed devices
     */
    getAllowedDevices(params: RouterIdParams): Promise<AllowedDevice[]>;

    /**
     * Returns devices not allowed on a router
     *
     * @param params.routerId Router identifier
     * @returns Devices not allowed on the router
     */
    getNotAllowedDevices(params: RouterIdParams): Promise<AllowedDevice[]>;

    /**
     * Returns routers associated with an allowed device
     *
     * @param params.allowedDeviceId Device identifier
     * @returns Associated routers
     */
    getRoutersByAllowedDevice(params: AllowedDeviceIdParams): Promise<RouterAllowedDevice[]>;

    /**
     * Creates a device
     *
     * @param params.clientTx Transaction client
     * @param params.device Device data
     * @returns Created device
     */
    create(params: InsertDeviceParams<Transaction>): Promise<Device>;

    /**
     * Updates a device
     *
     * @param params.clientTx Transaction client
     * @param params.id Device identifier
     * @param params.data Device data
     * @returns Updated device
     */
    update(params: UpdateDeviceParams<Transaction>): Promise<Device>;

    /**
     * Deletes a device
     *
     * @param params.id Device identifier
     * @returns Deleted device identifier or null
     */
    delete(params: DeviceId): Promise<DeviceId | null>;
}
