import ApiError from "../utils/error/api-error.js";
import { API_ERROR } from "../config/errors.js";

/**
 * Whitelist service
 *
 * @author HattoriHanzo-Ronin
 */
export default class WhitelistService {
    #whitelistModel;
    #entityError;

    constructor({ whitelistModel, entityError }) {
        this.#whitelistModel = whitelistModel;
        this.#entityError = entityError;
    }

    /**
     * Generates a whitelist key for a router
     *
     * @param {string} params.routerId Router identifier
     * @param {(keys: Object[]) => string | null} params.generateKey Callback that generates the router whitelist key
     * @returns {Promise<string | null>} Generated whitelist key
     */
    async getKey({ routerId, generateKey }) {
        return generateKey(await this.#whitelistModel.getKeys({ routerId }));
    }

    /**
     * Creates a whitelist entry
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {Object} params.whitelist Whitelist entry
     */
    async create({ clientTx, whitelist }) {
        try {
            return await this.#whitelistModel.insert({ clientTx, whitelist });
        } catch (err) {
            this.#entityError(err);
            throw err;
        }
    }

    /**
     * Deletes a whitelist entry
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {string} params.routerId Router identifier
     * @param {string} params.mac Connection MAC address
     * @returns {Promise<{ key: string | null }>} Deleted whitelist entry
     */
    async delete({ clientTx, routerId, mac }) {
        const result = await this.#whitelistModel.delete({ clientTx, routerId, mac });
        ApiError.handle([
            {
                condition: !result,
                message: "El dispositivo no se encuentra autorizado",
                status: 404,
                apiError: API_ERROR.whitelistNotAllowed
            }
        ]);
        return result;
    }
}
