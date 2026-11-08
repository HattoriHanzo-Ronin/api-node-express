import type {
    AddAllowParams,
    DeleteAllowParams,
    GeneratedKeysParams,
    RouterCapabilities
} from "../../../types/utils/router-automation.js";

/**
 * Router automation contract
 *
 * @author HattoriHanzo-Ronin
 */
export default interface RouterAutomation {
    /**
     * Returns router capabilities
     *
     * @returns Router capabilities
     */
    getCapabilities(): RouterCapabilities;

    /**
     * Generates a router whitelist key
     *
     * @param params.keys Current router whitelist keys
     * @returns Generated whitelist key
     */
    generateKey({ keys }: GeneratedKeysParams): string | null;

    /**
     * Creates a whitelist entry in the router
     *
     * @param params.key Router whitelist key
     * @param params.mac Device MAC address
     * @param params.name Device name
     */
    create({ key, mac, name }: AddAllowParams): Promise<void>;

    /**
     * Deletes a whitelist entry from the router
     *
     * @param params.key Router whitelist key
     * @param params.mac Device MAC address
     */
    delete({ key, mac }: DeleteAllowParams): Promise<void>;
}
