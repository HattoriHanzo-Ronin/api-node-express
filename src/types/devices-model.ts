import type { DEVICE_TYPE } from "../config/constants.js";
import type { ConnectionData, RouterConnection } from "./connections-model.js";

export type DeviceType = (typeof DEVICE_TYPE)[keyof typeof DEVICE_TYPE];

export type Device = {
    id: string;
    name: string;
    type: DeviceType;
    model: string | null;
    ip: string | null;
    ssid: string | null;
    wifi_pass: string | null;
    admin_pass: string | null;
    mac_filter: boolean | null;
};

export type DeviceInsert = Omit<Device, "id">;

export type DeviceUpdate = Partial<DeviceInsert>;

export type DeviceId = Pick<Device, "id">;

export type DeviceAllowedInfo = Pick<Device, "id" | "name" | "model" | "type">;

export type RouterDevice = Omit<Device, "type" | "ip" | "admin_pass" | "mac_filter"> & {
    type: (typeof DEVICE_TYPE)["router"];
    ip: string;
    admin_pass: string;
    mac_filter: boolean;
};

export type DeviceRouterInfo = Pick<RouterDevice, "id" | "name" | "model" | "ip" | "admin_pass">;

export type AllowedDevice = DeviceAllowedInfo & ConnectionData;

export type RouterAllowedDevice = DeviceRouterInfo & RouterConnection;
