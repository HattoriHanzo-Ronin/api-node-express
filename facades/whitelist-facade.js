import RouterResolver from "../devices-routers/router-resolver.js";
import ValidateUtils from "../utils/validate-utils.js";
import { API_ERROR } from "../config/constants.js";

/**
 * Whitelist facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class WhitelistFacade {
    constructor({ whitelistService, devicesFacade, tx }) {
        this.whitelistService = whitelistService;
        this.devicesFacade = devicesFacade;
        this.tx = tx;
    }

    /**
     * Creates a whitelist entry and synchronizes it with the router
     *
     * @param {string} params.routerId Router identifier
     * @param {Object} params.allowedDevice Allowed device data
     * @returns {Promise<{ id: string, mac: string }>} Allowed device identifier and connection MAC
     */
    async create({ routerId, allowedDevice }) {
        const { id, name, mac } = await this.#resolveAllowedDevice(allowedDevice);
        const routerImpl = await this.#getRouterImpl(routerId);
        const key = await this.whitelistService.getKey({
            routerId,
            generateKey: (keys) => routerImpl.generateKey(keys)
        });
        return this.tx(async (clientTx) => {
            await this.whitelistService.create({
                clientTx,
                whitelist: { router_id: routerId, connection_mac: mac, key }
            });
            await routerImpl.create({ key, name, mac });
            return { id, mac };
        });
    }

    /**
     * Deletes a whitelist entry and synchronizes it with the router
     *
     * @param {string} params.routerId Router identifier
     * @param {Object} params.allowedDevice Allowed device data
     * @returns {Promise<{ id: string, mac: string }>} Deleted allowed device identifier and connection MAC
     */
    async delete({ routerId, allowedDevice }) {
        const { id, mac } = await this.#resolveAllowedDevice(allowedDevice);
        const routerImpl = await this.#getRouterImpl(routerId);
        return this.tx(async (clientTx) => {
            const { key } = await this.whitelistService.delete({
                clientTx,
                routerId,
                mac
            });
            await routerImpl.delete({ key, mac });
            return { id, mac };
        });
    }

    async #getRouterImpl(id) {
        try {
            const router = await this.devicesFacade.getById({ id });
            return new RouterResolver(router);
        } catch (err) {
            handleApiErrors([
                {
                    condition: err.code === deviceNotFound.code,
                    message: "El router no existe",
                    status: 404,
                    apiError: whitelistRouterNotFound
                }
            ]);
            throw err;
        }
    }

    async #resolveAllowedDevice({ id, mac }) {
        const { name, connections } = await this.devicesFacade.getById({ id });
        handleApiErrors([
            {
                condition: !connections.some(({ mac: connectionMac }) => connectionMac === mac),
                message: "La mac no pertenece al dispositivo especificado",
                status: 400,
                apiError: connectionMacMismatch
            }
        ]);
        return { id, name, mac };
    }
}

const { handleApiErrors } = ValidateUtils;
const { deviceNotFound, whitelistRouterNotFound, connectionMacMismatch } = API_ERROR;
