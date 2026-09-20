import path from "node:path";
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
        const result = await this.#mutate(() => this.ftpService.move(data));
        const { dir, entries, destination, authUser } = data;
        const movedContent = this.#renamedEntriesToDomain({
            sourceDir: dir,
            destinationDir: destination,
            entries,
            renamedEntries: result.movedContent,
            authUser
        });
        return { ...result, movedContent };
    }

    /**
     * Renames a FTP resource and increments its data version
     *
     * @param {Object} data FTP rename data
     * @returns {Promise<Object>} Renamed resource
     */
    async rename(data) {
        const result = await this.#mutate(() => this.ftpService.rename(data));
        const { dir, entry, authUser } = data;
        return this.#renamedEntriesToDomain({
            sourceDir: dir,
            destinationDir: dir,
            entries: [entry],
            renamedEntries: [result],
            authUser
        })[0];
    }

    /**
     * Uploads FTP resources and increments their data version
     *
     * @param {Object} data FTP upload data
     * @returns {Promise<Object[]>} Uploaded resources
     */
    async upload(data) {
        const result = await this.#mutate(() => this.ftpService.upload(data));
        const { dir, authUser } = data;
        const names = result.filter(({ type }) => type === FILE_TYPE.file).map(({ name }) => name);
        const thumbnails = await this.ftpService.getThumbails({ dir, names, authUser });
        const cachedBufferMap = this.memoryCache.get(authUser.id, dir);
        const bufferMap = new Map([...(cachedBufferMap ?? []), ...thumbnails]);
        if (cachedBufferMap && thumbnails.size) {
            this.memoryCache.set(authUser.id, dir, bufferMap);
        }

        return this.ftpMapper.entriesToDomain({ entries: result, bufferMap });
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
        const result = await this.#mutate(() => this.ftpService.delete(data));
        const { dir, entries, authUser } = data;
        const cachedBufferMap = this.memoryCache.get(authUser.id, dir);
        const bufferMap = cachedBufferMap && new Map(cachedBufferMap);
        let updateBufferMap = false;
        for (const { name, type } of entries) {
            if (type === FILE_TYPE.file && bufferMap?.delete(name)) {
                updateBufferMap = true;
            }

            if (type === FILE_TYPE.dir) {
                this.memoryCache.delete(authUser.id, path.posix.join(dir, name));
            }
        }
        if (updateBufferMap) {
            this.memoryCache.set(authUser.id, dir, bufferMap);
        }

        return result;
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

    /**
     * Renames cached thumbnail keys and maps the resulting entries
     *
     * @param {string} params.sourceDir Source FTP directory path
     * @param {string} params.destinationDir Destination FTP directory path
     * @param {Object[]} params.entries Original FTP entries
     * @param {Object[]} params.renamedEntries Renamed FTP entries
     * @param {Object} params.authUser Authenticated user
     * @returns {Object[]} Domain FTP entries
     */
    #renamedEntriesToDomain({ sourceDir, destinationDir, entries, renamedEntries, authUser }) {
        const cachedSourceBufferMap = this.memoryCache.get(authUser.id, sourceDir);
        const cachedDestinationBufferMap =
            sourceDir === destinationDir ? cachedSourceBufferMap : this.memoryCache.get(authUser.id, destinationDir);
        const sourceBufferMap = cachedSourceBufferMap && new Map(cachedSourceBufferMap);
        const bufferMap =
            sourceDir === destinationDir ? (sourceBufferMap ?? new Map()) : new Map(cachedDestinationBufferMap);
        for (const [index, entry] of entries.entries()) {
            if (entry.type !== FILE_TYPE.file) {
                continue;
            }

            const thumbnail = sourceBufferMap?.get(entry.name);
            sourceBufferMap?.delete(entry.name);
            if (thumbnail !== undefined) {
                bufferMap.set(renamedEntries[index].name, thumbnail);
            }
        }
        if (sourceBufferMap) {
            this.memoryCache.set(authUser.id, sourceDir, sourceBufferMap);
        }

        if (sourceDir !== destinationDir && cachedDestinationBufferMap) {
            this.memoryCache.set(authUser.id, destinationDir, bufferMap);
        }

        return this.ftpMapper.entriesToDomain({ entries: renamedEntries, bufferMap });
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
