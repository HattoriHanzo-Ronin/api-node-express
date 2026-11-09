import type { Device } from "../types/devices/devices-facade.js";
import type { AllowedDevice, RouterAllowedDevice } from "../types/devices/devices-model.js";
import type {
    DeviceMapperParams,
    DeviceSources,
    DevicesMapperParams,
    RouterAutomationSource
} from "../types/devices/devices-mapper.js";

export default interface DevicesMapper {
    /**
     * Separates devices and connections from persistence rows
     *
     * @param source Device persistence rows
     * @returns Devices and connections
     */
    createDeviceSource(source: AllowedDevice[]): DeviceSources;

    /**
     * Maps persistence routers to automation sources
     *
     * @param source Router persistence rows
     * @returns Router automation sources
     */
    routersToAutomation(source: RouterAllowedDevice[]): RouterAutomationSource[];

    /**
     * Maps a persisted device to the domain model
     *
     * @param params.source Persisted device
     * @param params.connections Device connections
     * @returns Device
     */
    deviceToDomain(params: DeviceMapperParams): Device;

    /**
     * Maps persisted devices to the domain model
     *
     * @param params.devices Persisted devices
     * @param params.connectionsByDevice Connections by device identifier
     * @returns Devices
     */
    devicesToDomain(params: DevicesMapperParams): Device[];
}
