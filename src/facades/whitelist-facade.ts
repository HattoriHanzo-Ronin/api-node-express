import type { AllowedDevice, WhitelistParams } from "../types/whitelist-facade.js";

export default interface WhitelistFacade {
    /**
     * Creates a whitelist entry and synchronizes the router
     *
     * @param params.routerId Router identifier
     * @param params.allowedDevice Allowed device
     * @returns Allowed device identifier and MAC
     */
    create(params: WhitelistParams): Promise<AllowedDevice>;

    /**
     * Deletes a whitelist entry and synchronizes the router
     *
     * @param params.routerId Router identifier
     * @param params.allowedDevice Allowed device
     * @returns Allowed device identifier and MAC
     */
    delete(params: WhitelistParams): Promise<AllowedDevice>;
}
