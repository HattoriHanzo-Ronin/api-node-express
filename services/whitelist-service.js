import PostgresErrors from "../utils/postgres-errors.js";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * Whitelist service
 *
 * @author HattoriHanzo-Ronin
 */
export default class WhitelistService {
    constructor({ whitelistModel }) {
        this.whitelistModel = whitelistModel;
    }

    /**
     * Generates a whitelist key for a router
     *
     * @param {string} params.routerId Router identifier
     * @param {(keys: Object[]) => string | null} params.generateKey Callback that generates the router whitelist key
     * @returns {Promise<string | null>} Generated whitelist key
     */
    async getKey({ routerId, generateKey }) {
        return generateKey(await this.whitelistModel.getKeys({ routerId }));
    }

    /**
     * Creates a whitelist entry
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {Object} params.whitelist Whitelist entry
     * @returns {Promise<{ allowed_device_id: string }>} Allowed device identifier
     */
    async create({ clientTx, whitelist }) {
        try {
            return await this.whitelistModel.insert({ clientTx, whitelist });
        } catch (err) {
            postgresError(err);
            throw err;
        }
    }

    /**
     * Deletes a whitelist entry
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {string} params.routerId Router identifier
     * @param {string} params.allowedDeviceId Allowed device identifier
     * @returns {Promise<{ allowed_device_id: string, key: string }>} Deleted whitelist entry
     */
    async delete({ clientTx, routerId, allowedDeviceId }) {
        const result = await this.whitelistModel.delete({ clientTx, routerId, allowedDeviceId });
        handleApiErrors([
            {
                condition: !result,
                message: "El dispositivo no se encuentra autorizado",
                status: 404,
                code: "WHITELIST_NOT_ALLOWED"
            }
        ]);
        return result;
    }
}

const { handleApiErrors } = ValidateUtils;
const { whitelist: postgresError } = PostgresErrors;
