import { API_ERROR, FILE_TYPE } from "../config/constants.js";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * FTP facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpFacade {
    constructor({ ftpService, dataVersionsService, ftpMapper, memoryCache, tx }) {
        this.ftpService = ftpService;
        this.dataVersionsService = dataVersionsService;
        this.ftpMapper = ftpMapper;
        this.memoryCache = memoryCache;
        this.tx = tx;
    }

    /**
     * Returns FTP directory content
     *
     * @param {Object} data FTP directory data
     * @returns {Promise<{ version: string, data: Object[] }>} Directory resources
     */
    async dir(data) {
        const { dir, authUser } = data;
        const [{ version }, result] = await Promise.all([
            this.dataVersionsService.getById({ id: "ftp" }),
            this.ftpService.dir(data)
        ]);
        const names = result.filter(({ type }) => type === FILE_TYPE.file).map(({ name }) => name);
        const bufferMap = await this.#syncThumbnails({ dir, names, authUser });
        return { version, data: this.ftpMapper.entriesToDomain({ entries: result, bufferMap }) };
    }

    /**
     * Returns a cached FTP thumbnail
     *
     * @param {string} params.dir FTP directory path
     * @param {string} params.name File name
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<Buffer>} JPEG thumbnail
     */
    async getThumbnail({ dir, name, authUser }) {
        let bufferMap = this.memoryCache.get(authUser.id, dir);
        if (!bufferMap) {
            await this.dir({ dir, authUser });
            bufferMap = this.memoryCache.get(authUser.id, dir);
        }

        const thumbnail = bufferMap?.get(name);
        handleApiErrors([
            {
                condition: !thumbnail,
                message: "La miniatura no existe",
                status: 404,
                apiError: ftpThumbnailNotFound
            }
        ]);
        return thumbnail;
    }

    /**
     * Creates a FTP directory and increments its data version
     *
     * @param {Object} data FTP directory data
     * @returns {Promise<Object>} Created directory
     */
    async makeDir(data) {
        return this.#mutate(() => this.ftpService.makeDir(data));
    }

    /**
     * Moves FTP resources and increments their data version
     *
     * @param {Object} data FTP move data
     * @returns {Promise<Object>} Moved resources
     */
    async move(data) {
        return this.#mutate(() => this.ftpService.move(data));
    }

    /**
     * Renames a FTP resource and increments its data version
     *
     * @param {Object} data FTP rename data
     * @returns {Promise<Object>} Renamed resource
     */
    async rename(data) {
        return this.#mutate(() => this.ftpService.rename(data));
    }

    /**
     * Uploads FTP resources and increments their data version
     *
     * @param {Object} data FTP upload data
     * @returns {Promise<Object[]>} Uploaded resources
     */
    async upload(data) {
        return this.#mutate(() => this.ftpService.upload(data));
    }

    /**
     * Downloads FTP resources
     *
     * @param {Object} data FTP download data
     * @returns {Promise<string>} Downloaded resource path
     */
    async download(data) {
        return this.ftpService.download(data);
    }

    /**
     * Deletes FTP resources and increments their data version
     *
     * @param {Object} data FTP delete data
     * @returns {Promise<string[]>} Deleted resource names
     */
    async delete(data) {
        return this.#mutate(() => this.ftpService.delete(data));
    }

    /**
     * Synchronizes cached thumbnails with current FTP file names
     *
     * @param {string} params.dir FTP directory path
     * @param {string[]} params.names Current FTP file names
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<Map<string, Buffer | null>>} Synchronized thumbnails
     */
    async #syncThumbnails({ dir, names, authUser }) {
        const cachedBufferMap = this.memoryCache.get(authUser.id, dir);
        if (!cachedBufferMap) {
            const bufferMap = await this.ftpService.getThumbails({ dir, names, authUser });
            this.memoryCache.set(authUser.id, dir, bufferMap);
            return bufferMap;
        }

        let bufferMap = new Map(cachedBufferMap);
        const removedNames = new Set(bufferMap.keys());
        const missingNames = names.filter((name) => !removedNames.delete(name));
        for (const name of removedNames) {
            bufferMap.delete(name);
        }
        let updateBufferMap = removedNames.size > 0;
        if (missingNames.length) {
            const newThumbnails = await this.ftpService.getThumbails({ dir, names: missingNames, authUser });
            bufferMap = new Map([...bufferMap, ...newThumbnails]);
            updateBufferMap ||= newThumbnails.size > 0;
        }

        if (updateBufferMap) {
            this.memoryCache.set(authUser.id, dir, bufferMap);
        }

        return bufferMap;
    }

    async #mutate(callback) {
        return this.tx(async (clientTx) => {
            const result = await callback();
            await this.dataVersionsService.increment({
                clientTx,
                id: "ftp"
            });
            return result;
        });
    }
}

const { handleApiErrors } = ValidateUtils;
const { ftpThumbnailNotFound } = API_ERROR;
