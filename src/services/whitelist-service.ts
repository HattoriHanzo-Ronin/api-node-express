import type { DeleteWhitelistParams, InsertWhitelistParams, Whitelist } from "../types/whitelist-model.js";
import type { GetWhitelistKeyParams } from "../types/whitelist-service.js";

export default interface WhitelistService<Transaction> {
    /**
     * Generates a whitelist key for a router
     *
     * @param params.routerId Router identifier
     * @param params.generateKey Key generator
     * @returns Generated key
     */
    getKey(params: GetWhitelistKeyParams): Promise<string | null>;

    /**
     * Creates a whitelist entry
     *
     * @param params.clientTx Transaction client
     * @param params.whitelist Whitelist entry
     * @returns Insertion result
     */
    create(params: InsertWhitelistParams<Transaction>): Promise<null>;

    /**
     * Deletes a whitelist entry
     *
     * @param params.clientTx Transaction client
     * @param params.routerId Router identifier
     * @param params.mac Connection MAC address
     * @returns Deleted key
     */
    delete(params: DeleteWhitelistParams<Transaction>): Promise<Pick<Whitelist, "key">>;
}
