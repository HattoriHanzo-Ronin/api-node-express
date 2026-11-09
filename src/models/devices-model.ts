import type {
    AllowedDevice,
    AllowedDeviceIdParams,
    Device,
    DeviceId,
    InsertDeviceParams,
    RouterAllowedDevice,
    RouterIdParams,
    UpdateDeviceParams
} from "../types/devices/devices-model.js";

export default interface DevicesModel<Transaction> {
    /**
     * Returns all devices
     *
     * @returns Devices
     */
    getAll(): Promise<Device[]>;

    /**
     * Returns a device by identifier
     *
     * @param params.id Device identifier
     * @returns Device or null
     */
    getById(params: DeviceId): Promise<Device | null>;

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
     * Inserts a device
     *
     * @param params.clientTx Transaction client
     * @param params.device Device data
     * @returns Inserted device
     */
    insert(params: InsertDeviceParams<Transaction>): Promise<Device>;

    /**
     * Updates a device
     *
     * @param params.clientTx Transaction client
     * @param params.id Device identifier
     * @param params.data Device data
     * @returns Updated device or null
     */
    update(params: UpdateDeviceParams<Transaction>): Promise<Device | null>;

    /**
     * Deletes a device
     *
     * @param params.id Device identifier
     * @returns Deleted device identifier or null
     */
    delete(params: DeviceId): Promise<DeviceId | null>;
}
