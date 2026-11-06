import type { DeviceId, RouterIdParams } from "../types/devices-model.js";
import type { RouterCpanelSession } from "../types/router-cpanel.js";
import type { GetAllDevicesParams } from "../types/devices-service.js";
import type { CloseDeviceRouterCpanelParams, CreateDeviceParams, CreateDeviceRouterCpanelParams, Device, DevicesByRouterResponse, DevicesResponse, NavigateDeviceRouterCpanelParams, UpdateDeviceFacadeParams } from "../types/devices-facade.js";

export default interface DevicesFacade {
    /**
     * Returns all devices
     *
     * @returns Devices and version
     */
    getAll(params: GetAllDevicesParams): Promise<DevicesResponse>;
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
     * @returns Devices and versions
     */
    getAllowedDevices(params: RouterIdParams): Promise<DevicesByRouterResponse>;
    /**
     * Returns devices not allowed on a router
     *
     * @param params.routerId Router identifier
     * @returns Devices and versions
     */
    getNotAllowedDevices(params: RouterIdParams): Promise<DevicesByRouterResponse>;
    /**
     * Creates a router control panel session
     *
     * @param params.authUser Authenticated user
     * @param params.routerId Router identifier
     * @param params.language Viewer language
     * @param params.clientType Viewer client type
     * @param params.theme Viewer theme
     * @returns Router control panel session
     */
    createRouterCpanel(params: CreateDeviceRouterCpanelParams): Promise<RouterCpanelSession>;
    /**
     * Navigates a router control panel session
     *
     * @param params.authUser Authenticated user
     * @param params.sessionId Session identifier
     * @param params.action Navigation action
     */
    navigateRouterCpanel(params: NavigateDeviceRouterCpanelParams): Promise<void>;
    /**
     * Closes a router control panel session
     *
     * @param params.authUser Authenticated user
     * @param params.sessionId Session identifier
     */
    closeRouterCpanel(params: CloseDeviceRouterCpanelParams): Promise<void>;
    /**
     * Creates a device
     *
     * @param params.device Device data
     * @returns Created device
     */
    create(params: CreateDeviceParams): Promise<Device>;
    /**
     * Updates a device
     *
     * @param params.data Device data
     * @returns Updated device
     */
    update(params: UpdateDeviceFacadeParams): Promise<Device>;
    /**
     * Deletes a device
     *
     * @param params.id Device identifier
     * @returns Deleted device identifier or null
     */
    delete(params: DeviceId): Promise<DeviceId | null>;
}
