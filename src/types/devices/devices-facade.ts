import type { ConnectionData } from "../connections/connections-model.js";
import type { Device as DeviceModel, DeviceId, DeviceInsert } from "./devices-model.js";
import type { RouterCapabilities } from "../utils/router-automation.js";
import type { AuthUserParams } from "../auth/auth-facade.js";
import type { RouterCpanelAction, RouterCpanelClientType, RouterCpanelTheme } from "../utils/router-cpanel.js";
import type { DEVICE_TYPE } from "../../config/constants.js";

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

export type CreateDevice = DeviceInsert & { connections: ConnectionData[] };
export type UpdateDevice = DeviceId & Partial<CreateDevice>;
export type CreateDeviceParams = { device: CreateDevice };
export type UpdateDeviceFacadeParams = { data: UpdateDevice };
export type CreateDeviceRouterCpanelParams = AuthUserParams & {
    routerId: string;
    language?: string;
    clientType: RouterCpanelClientType;
    theme: RouterCpanelTheme;
};
export type NavigateDeviceRouterCpanelParams = AuthUserParams & {
    sessionId: string;
    action: RouterCpanelAction;
};
export type CloseDeviceRouterCpanelParams = Omit<NavigateDeviceRouterCpanelParams, "action">;
