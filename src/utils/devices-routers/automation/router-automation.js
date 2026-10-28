import ApiError from "../../error/api-error.js";
import { API_ERROR } from "../../../config/errors.js";
import ArcherAX53Router from "./routers/tp-link/archer-ax53.js";
import TLWDR5620GigabitEditionRouter from "./routers/tp-link/tl-wdr5620-gigabit-edition.js";

const { routerImplementationNotFound, routerAddFailed, routerDeleteFailed } = API_ERROR;

/**
 * Router automation
 *
 * @author HattoriHanzo-Ronin
 */
export default class RouterAutomation {
    static #IMPLEMENTATIONS = Object.freeze({
        "TP-Link TL-WDR5620 Gigabit Edition": TLWDR5620GigabitEditionRouter,
        "TP-Link Archer AX53": ArcherAX53Router
    });

    #router;

    constructor({ router }) {
        const RouterImplementation = RouterAutomation.#IMPLEMENTATIONS[router.model];
        ApiError.handle([{
            condition: !RouterImplementation,
            message: `${router.name} no tiene implementación disponible`,
            apiError: routerImplementationNotFound,
            status: 400
        }]);
        this.#router = new RouterImplementation({ router });
    }

    /**
     * Returns router capabilities
     *
     * @returns {{ addAllow: boolean, deleteAllow: boolean }} Router capabilities
     */
    getCapabilities() {
        return this.#router.getCapabilities();
    }

    /**
     * Generates a router whitelist key
     *
     * @param {Object[]} params.keys Current router whitelist keys
     * @returns {string | null} Generated whitelist key
     */
    generateKey({ keys }) {
        return this.#router.generateKey({ keys });
    }

    /**
     * Creates a whitelist entry in the router
     *
     * @param {string | null} params.key Router whitelist key
     * @param {string} params.mac Device MAC address
     * @param {string} params.name Device name
     */
    async create({ key, mac, name }) {
        if (!this.getCapabilities().addAllow) {
            return;
        }

        const added = await this.#router.addAllow({ key, mac, name });
        ApiError.handle([{
            condition: !added,
            message: "Error al insertar el dispositivo en el router",
            status: 400,
            apiError: routerAddFailed
        }]);
    }

    /**
     * Deletes a whitelist entry from the router
     *
     * @param {string | null} params.key Router whitelist key
     * @param {string} params.mac Device MAC address
     */
    async delete({ key, mac }) {
        if (!this.getCapabilities().deleteAllow) {
            return;
        }

        const deleted = await this.#router.deleteAllow({ key, mac });
        ApiError.handle([{
            condition: !deleted,
            message: "Error al eliminar el dispositivo del router",
            status: 400,
            apiError: routerDeleteFailed
        }]);
    }
}
