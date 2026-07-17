import ValidateUtils from "../utils/validate-utils.js";
import { API_ERROR } from "../config/constants.js";
import ArcherAX53Router from "./tp-link/archer-ax53.js";
import TLWDR5620GigabitEditionRouter from "./tp-link/tl-wdr5620-gigabit-edition.js";

/**
 * Resolves router implementations
 *
 * @author HattoriHanzo-Ronin
 */
export default class RouterResolver {
    #router;

    constructor(router) {
        switch (router.model) {
            case "TP-Link TL-WDR5620 Gigabit Edition": {
                this.#router = new TLWDR5620GigabitEditionRouter(router);
                break;
            }
            case "TP-Link Archer AX53": {
                this.#router = new ArcherAX53Router(router);
                break;
            }
            default: {
                handleApiErrors([
                    {
                        condition: true,
                        message: `${router.name} no tiene implementación disponible`,
                        apiError: routerImplementationNotFound,
                        status: 400
                    }
                ]);
            }
        }
    }

    /**
     * Retrieves the capabilities supported by the router implementation
     *
     * @returns {{ addAllow: boolean, deleteAllow: boolean }}
     */
    getCapabilities() {
        return this.#router.getCapabilities();
    }

    /**
     * Generates a router-specific key for a whitelist entry
     *
     * @param {Object[]} keys Existing router whitelist keys
     * @returns {string | null} Generated key or null when the router does not require one
     */
    generateKey(keys) {
        return this.#router.generateKey(keys);
    }

    /**
     * Creates a whitelist entry in the router
     *
     * @param {Object} data Whitelist device data
     * @returns {Promise<void>}
     */
    async create(data) {
        const { addAllow } = this.getCapabilities();
        if (addAllow) {
            const added = await this.#router.addAllow(data);
            handleApiErrors([
                {
                    condition: !added,
                    message: "Error al insertar el dispositivo en el router",
                    status: 400,
                    apiError: routerAddFailed
                }
            ]);
        }
    }

    /**
     * Deletes a whitelist entry from the router
     *
     * @param {Object} data Whitelist device data
     * @returns {Promise<void>}
     */
    async delete(data) {
        const { deleteAllow } = this.getCapabilities();
        if (deleteAllow) {
            const deleted = await this.#router.deleteAllow(data);
            handleApiErrors([
                {
                    condition: !deleted,
                    message: "Error al eliminar el dispositivo del router",
                    status: 400,
                    apiError: routerDeleteFailed
                }
            ]);
        }
    }
}

const { handleApiErrors } = ValidateUtils;
const { routerImplementationNotFound, routerAddFailed, routerDeleteFailed } = API_ERROR;
