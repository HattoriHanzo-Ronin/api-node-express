import type { RouterIdParams } from "../devices/devices-model.js";
import type { WhitelistKey } from "./whitelist-model.js";

export type GetWhitelistKeyParams = RouterIdParams & { generateKey: (keys: WhitelistKey[]) => string | null };
