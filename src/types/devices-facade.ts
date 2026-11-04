import type { RouterCpanelSession } from "./router-cpanel.js";
import type { ConnectionData } from "./connections-model.js";
import type { Device as DeviceModel } from "./devices-model.js";
import type { RouterCapabilities } from "./router-automation.js";
import type { DEVICE_TYPE } from "../config/constants.js";

export type Device = Omit<DeviceModel, "model" | "ip" | "ssid" | "wifi_pass" | "admin_pass" | "mac_filter"> &
    Partial<Pick<DeviceModel, "model" | "ip" | "ssid" | "wifi_pass" | "admin_pass" | "mac_filter">> & {
        connections: ConnectionData[];
        capabilities?: RouterCapabilities;
    };

export type RouterDevice = Omit<Device, "type" | "model" | "ip" | "admin_pass"> & {
    type: (typeof DEVICE_TYPE)["router"];
    model: string;
    ip: string;
    admin_pass: string;
};

export type DevicesResponse = {
    version: string;
    data: Device[];
};

export type DevicesByRouterResponse = {
    version: Record<string, string>;
    data: Device[];
};

export type RouterCpanelResponse = RouterCpanelSession;
