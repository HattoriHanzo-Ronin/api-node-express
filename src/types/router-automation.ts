import type { RouterDevice } from "./devices-facade.js";
import type { WhitelistKey } from "./whitelist-model.js";

export type RouterCapabilities = {
    addAllow: boolean;
    deleteAllow: boolean;
};

export type RouterAutomationPayload = Pick<RouterDevice, "name" | "model" | "ip" | "admin_pass">;

export type GeneratedKeysParams = {
    keys: WhitelistKey[];
};

export type AddAllowParams = {
    key: string | null;
    mac: string;
    name: string;
};

export type DeleteAllowParams = Omit<AddAllowParams, "name">;
