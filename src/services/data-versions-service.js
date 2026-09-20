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
     * @param {string | string[]} params.id Resource identifier or identifiers
     * @returns {Promise<{ version: string } | Object<string, string> | null>} Data version
     */
    async getById({ id }) {
        if (Array.isArray(id)) {
            const dataVersions = await this.dataVersionsModel.getByIds({ ids: id });
            return Object.fromEntries(dataVersions.map(({ id: entity, version }) => [entity, version]));
        }

        return this.dataVersionsModel.getById({ id });
    }

}
