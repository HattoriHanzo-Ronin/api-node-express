import type { RouterIdParams, DeviceId } from "../devices/devices-model.js";
import type { ConnectionData } from "../connections/connections-model.js";

export type AllowedDevice = DeviceId & Pick<ConnectionData, "mac">;
export type WhitelistParams = RouterIdParams & { allowedDevice: AllowedDevice };
