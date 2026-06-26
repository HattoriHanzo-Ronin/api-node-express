import RouterResolver from "../devices-routers/router-resolver.js";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * Whitelist facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class WhitelistFacade {
    constructor({ whitelistService, devicesService, tx }) {
        this.whitelistService = whitelistService;
        this.devicesService = devicesService;
        this.tx = tx;
    }

    /**
     * Creates a whitelist entry and synchronizes it with the router
     *
     * @param {string} params.routerId Router identifier
     * @param {Object} params.allowedDevice Allowed device data
     * @returns {Promise<{ id: string }>} Allowed device identifier
     */
    async create({ routerId, allowedDevice }) {
        const routerImpl = await this.#getRouterImpl(routerId);
        const { id: allowedDeviceId } = allowedDevice;
        const key = await this.whitelistService.getKey({
            routerId,
            generateKey: (keys) => routerImpl.generateKey(keys)
        });
        return this.tx(async (clientTx) => {
            const { allowed_device_id: id } = await this.whitelistService.create({
                clientTx,
                whitelist: { router_id: routerId, allowed_device_id: allowedDeviceId, key }
            });
            await routerImpl.create({ key, ...allowedDevice });
            return { id };
        });
    }

    /**
     * Deletes a whitelist entry and synchronizes it with the router
     *
     * @param {string} params.routerId Router identifier
     * @param {Object} params.allowedDevice Allowed device data
     * @returns {Promise<{ id: string }>} Deleted allowed device identifier
     */
    async delete({ routerId, allowedDevice }) {
        const routerImpl = await this.#getRouterImpl(routerId);
        const { id: allowedDeviceId } = allowedDevice;
        return this.tx(async (clientTx) => {
            const { allowed_device_id: id, key } = await this.whitelistService.delete({
                clientTx,
                routerId,
                allowedDeviceId
            });
            await routerImpl.delete({ key, ...allowedDevice });
            return { id };
        });
    }

    async #getRouterImpl(id) {
        try {
            const router = await this.devicesService.getById({ id });
            return new RouterResolver(router);
        } catch (err) {
            handleApiErrors([
                {
                    condition: err.code === "DEVICE_NOT_FOUND",
                    message: "El router no existe",
                    status: 404,
                    code: "WHITELIST_ROUTER_NOT_FOUND"
                }
            ]);
            throw err;
        }
    }
}

const { handleApiErrors } = ValidateUtils;
