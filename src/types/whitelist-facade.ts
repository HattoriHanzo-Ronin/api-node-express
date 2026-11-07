import type { RouterIdParams, DeviceId } from "./devices-model.js";
import type { ConnectionData } from "./connections-model.js";

export type AllowedDevice = DeviceId & Pick<ConnectionData, "mac">;
export type WhitelistParams = RouterIdParams & { allowedDevice: AllowedDevice };
