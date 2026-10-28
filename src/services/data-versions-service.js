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
     * Returns data versions by resource identifiers
     *
     * @param {string[]} params.ids Resource identifiers
     * @returns {Promise<{ id: string, version: string }[]>} Data versions
     */
    async getByIds({ ids }) {
        return this.dataVersionsModel.getByIds({ ids });
    }
}
