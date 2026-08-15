/**
 * Data versions service
 *
 * @author HattoriHanzo-Ronin
 */
export default class DataVersionsService {
    constructor({ dataVersionsModel }) {
        this.dataVersionsModel = dataVersionsModel;
    }

    /**
     * Returns a data version by its resource identifier
     *
     * @param {string} params.id Resource identifier
     * @returns {Promise<{ version: string } | null>} Data version
     */
    async getById({ id }) {
        return this.dataVersionsModel.getById({ id });
    }

    /**
     * Increments a data version
     *
     * @param {import("pg-promise").ITask<unknown>} params.clientTx PostgreSQL transaction client
     * @param {string} params.id Resource identifier
     * @returns {Promise<void>}
     */
    async increment({ clientTx, id }) {
        return this.dataVersionsModel.increment({ clientTx, id });
    }
}
