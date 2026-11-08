import type { Device as DeviceModel, DeviceAllowedInfo, RouterAllowedDevice } from "./devices-model.js";
import type { Device } from "./devices-facade.js";
import type { Connection, ConnectionData, RouterConnection } from "../connections/connections-model.js";

export type DeviceMapperSource = DeviceModel | DeviceAllowedInfo | DeviceWithoutConnections;
export type DeviceWithoutConnections = Omit<Device, "connections" | "capabilities">;
export type DeviceMapperParams = { source: DeviceMapperSource; connections: ConnectionData[] };
export type DevicesMapperParams = { devices: DeviceMapperSource[]; connectionsByDevice: Map<string, ConnectionData[]> };
export type DeviceSources = { devices: DeviceAllowedInfo[]; connections: Connection[] };
export type RouterAutomationSource = Omit<RouterAllowedDevice, keyof RouterConnection> & {
    connections: RouterConnection[];
};
