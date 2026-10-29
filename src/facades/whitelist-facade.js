import ApiError from "../utils/error/api-error.js";
import { SOCKET_ENTITY } from "../config/constants.js";
import { API_ERROR } from "../config/errors.js";

const { deviceNotFound, whitelistRouterNotFound, connectionMacMismatch } = API_ERROR;

/**
 * Whitelist facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class WhitelistFacade {
    #whitelistService;
    #dataVersionsFacade;
    #devicesFacade;
    #routerAutomation;
    #socketSessionsFacade;
    #tx;

    constructor({ whitelistService, dataVersionsFacade, devicesFacade, routerAutomation, socketSessionsFacade, tx }) {
        this.#whitelistService = whitelistService;
        this.#dataVersionsFacade = dataVersionsFacade;
        this.#devicesFacade = devicesFacade;
        this.#routerAutomation = routerAutomation;
        this.#socketSessionsFacade = socketSessionsFacade;
        this.#tx = tx;
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
        const key = await this.#whitelistService.getKey({
            routerId,
            generateKey: (keys) => routerImpl.generateKey({ keys })
        });
        const result = await this.#tx(async (clientTx) => {
            await this.#whitelistService.create({
                clientTx,
                whitelist: { router_id: routerId, connection_mac: mac, key }
            });
            await routerImpl.create({ key, name, mac });
            return { id, mac };
        });
        await this.#notify();
        return result;
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
        const result = await this.#tx(async (clientTx) => {
            const { key } = await this.#whitelistService.delete({
                clientTx,
                routerId,
                mac
            });
            await routerImpl.delete({ key, mac });
            return { id, mac };
        });
        await this.#notify();
        return result;
    }

    async #notify() {
        const { version } = await this.#dataVersionsFacade.getById({ id: SOCKET_ENTITY.whitelist });
        this.#socketSessionsFacade.notify({ entity: SOCKET_ENTITY.whitelist, data: { version } });
    }

    async #getRouterImpl(id) {
        try {
            const router = await this.#devicesFacade.getById({ id });
            return new this.#routerAutomation({ router });
        } catch (err) {
            ApiError.handle([
                {
                    condition: err.code === deviceNotFound,
                    message: "El router no existe",
                    status: 404,
                    apiError: whitelistRouterNotFound
                }
            ]);
            throw err;
        }
    }

    async #resolveAllowedDevice({ id, mac }) {
        const { name, connections } = await this.#devicesFacade.getById({ id });
        ApiError.handle([
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
