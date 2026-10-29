/**
 * Data versions facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class DataVersionsFacade {
    #dataVersionsService;
    #dataVersionsMapper;
    #ftpFacade;

    constructor({ dataVersionsService, dataVersionsMapper, ftpFacade }) {
        this.#dataVersionsService = dataVersionsService;
        this.#dataVersionsMapper = dataVersionsMapper;
        this.#ftpFacade = ftpFacade;
    }

    /**
     * Returns data versions by their resource identifiers
     *
     * @param {string | string[]} params.id Resource identifier or identifiers
     * @returns {Promise<{ version: string } | Object<string, string> | null>} Data version or versions
     */
    async getById({ id }) {
        if (Array.isArray(id)) {
            return this.#dataVersionsMapper.versionsToDomain(await this.#dataVersionsService.getByIds({ ids: id }));
        }
        return this.#dataVersionsService.getById({ id });
    }

    /**
     * Returns a FTP directory version
     *
     * @param {string} params.dir FTP directory path
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ version: string }>} FTP directory version
     */
    async getFtp({ dir, authUser }) {
        return { version: await this.#ftpFacade.getHash({ dir, authUser }) };
    }
}
