/**
 * Data versions facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class DataVersionsFacade {
    constructor({ dataVersionsService, ftpFacade }) {
        this.dataVersionsService = dataVersionsService;
        this.ftpFacade = ftpFacade;
    }

    /**
     * Returns data versions by their resource identifiers
     *
     * @param {string[]} params.id Resource identifiers
     * @returns {Promise<Object<string, string>>} Data versions
     */
    async getById({ id }) {
        return this.dataVersionsService.getById({ id });
    }

    /**
     * Returns a FTP directory version
     *
     * @param {string} params.dir FTP directory path
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ version: string }>} FTP directory version
     */
    async getFtp({ dir, authUser }) {
        return { version: await this.ftpFacade.getHash({ dir, authUser }) };
    }
}
