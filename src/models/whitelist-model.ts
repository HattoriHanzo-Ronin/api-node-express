import type { RouterIdParams } from "../types/devices/devices-model.js";
import type { DeleteWhitelistParams, InsertWhitelistParams, Whitelist, WhitelistKey } from "../types/whitelist/whitelist-model.js";

export default interface WhitelistModel<Transaction> {
    /**
     * Returns router whitelist keys
     *
     * @param params.routerId Router identifier
     * @returns Whitelist keys
     */
    getKeys(params: RouterIdParams): Promise<WhitelistKey[]>;

    /**
     * Inserts a whitelist entry
     *
     * @param params.clientTx Transaction client
     * @param params.whitelist Whitelist entry
     * @returns Insertion result
     */
    insert(params: InsertWhitelistParams<Transaction>): Promise<null>;

    /**
     * Deletes a whitelist entry
     *
     * @param params.clientTx Transaction client
     * @param params.routerId Router identifier
     * @param params.mac Connection MAC address
     * @returns Deleted key or null
     */
    delete(params: DeleteWhitelistParams<Transaction>): Promise<Pick<Whitelist, "key"> | null>;
}
