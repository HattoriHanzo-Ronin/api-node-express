import type WhitelistService from "../whitelist-service.js";
import type { WhitelistServiceDependencies } from "../../types/default-whitelist-service.js";
import type { DeleteWhitelistParams, InsertWhitelistParams } from "../../types/whitelist-model.js";
import type { GetWhitelistKeyParams } from "../../types/whitelist-service.js";
import type { PostgresError } from "../../types/postgres-error.js";
import ApiError from "../../utils/error/api-error.js";
import { API_ERROR } from "../../config/errors.js";

/**
 * Default whitelist service
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultWhitelistService<Transaction> implements WhitelistService<Transaction> {
    constructor(private readonly dependencies: WhitelistServiceDependencies<Transaction>) {}

    async getKey({ routerId, generateKey }: GetWhitelistKeyParams) {
        return generateKey(await this.dependencies.whitelistModel.getKeys({ routerId }));
    }

    async create({ clientTx, whitelist }: InsertWhitelistParams<Transaction>) {
        try {
            return await this.dependencies.whitelistModel.insert({ clientTx, whitelist });
        } catch (err) {
            this.dependencies.entityError(err as PostgresError);
            throw err;
        }
    }

    async delete({ clientTx, routerId, mac }: DeleteWhitelistParams<Transaction>) {
        const result = await this.dependencies.whitelistModel.delete({ clientTx, routerId, mac });
        ApiError.handle([{
            condition: !result,
            message: "El dispositivo no se encuentra autorizado",
            status: 404,
            apiError: API_ERROR.whitelistNotAllowed
        }]);
        return result!;
    }
}
