import path from "node:path";
import { createHash } from "node:crypto";
import { API_ERROR, FILE_TYPE } from "../config/constants.js";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * FTP facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpFacade {
    constructor({ ftpService, ftpMapper, memoryCache, directoryCache }) {
        this.ftpService = ftpService;
        this.ftpMapper = ftpMapper;
        this.memoryCache = memoryCache;
        this.directoryCache = directoryCache;
    }

    /**
     * Returns FTP directory content
     *
     * @param {Object} data FTP directory data
     * @returns {Promise<{ hash: string, data: Object[] }>} Directory resources
     */
    async dir(data) {
        const { dir, authUser } = data;
        const result = await this.ftpService.dir(data);
        const names = result.filter(({ type }) => type === FILE_TYPE.file).map(({ name }) => name);
        const bufferMap = await this.#syncThumbnails({ dir, names, authUser });
        const hash = await this.#watchDirectory({ dir, authUser, entries: result });
        return { hash, data: this.ftpMapper.entriesToDomain({ entries: result, bufferMap }) };
    }

    /**
     * Returns a FTP directory hash
     *
     * @param {string} params.dir FTP directory path
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<string>} Directory hash
     */
    async getHash({ dir, authUser }) {
        const directory = this.directoryCache.get(authUser.id, dir);
        if (directory) {
            return directory.hash;
        }

        const { hash } = await this.dir({ dir, authUser });
        return hash;
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
     * Creates a FTP directory
     *
     * @param {Object} data FTP directory data
     * @returns {Promise<{ hash: string, data: Object[] }>} Updated directory resources
     */
    async makeDir(data) {
        await this.ftpService.makeDir(data);
        return this.dir({ dir: data.dir, authUser: data.authUser });
    }

    /**
     * Moves FTP resources
     *
     * @param {Object} data FTP move data
     * @returns {Promise<{ hash: string, data: Object[] }>} Destination directory resources
     */
    async move(data) {
        const result = await this.ftpService.move(data);
        const { dir, destination, entries, authUser } = data;
        for (const [index, entry] of entries.entries()) {
            if (entry.type === FILE_TYPE.dir) {
                await this.#moveCachedDirectory(
                    authUser.id,
                    path.posix.join(dir, entry.name),
                    path.posix.join(destination, result.movedContent[index].name)
                );
            }
        }

        this.memoryCache.delete(authUser.id, dir);
        this.directoryCache.delete(authUser.id, dir);
        return this.dir({ dir: destination, authUser });
    }

    /**
     * Renames a FTP resource
     *
     * @param {Object} data FTP rename data
     * @returns {Promise<{ hash: string, data: Object[] }>} Updated directory resources
     */
    async rename(data) {
        const result = await this.ftpService.rename(data);
        const { dir, entry, authUser } = data;
        if (entry.type === FILE_TYPE.dir) {
            await this.#moveCachedDirectory(
                authUser.id,
                path.posix.join(dir, entry.name),
                path.posix.join(dir, result.name)
            );
        }

        return this.dir({ dir, authUser });
    }

    /**
     * Uploads FTP resources
     *
     * @param {Object} data FTP upload data
     * @returns {Promise<{ hash: string, data: Object[] }>} Updated directory resources
     */
    async upload(data) {
        await this.ftpService.upload(data);
        return this.dir({ dir: data.dir, authUser: data.authUser });
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
     * Deletes FTP resources
     *
     * @param {Object} data FTP delete data
     * @returns {Promise<{ hash: string, data: Object[] }>} Updated directory resources
     */
    async delete(data) {
        await this.ftpService.delete(data);
        const { dir, entries, authUser } = data;
        for (const entry of entries) {
            if (entry.type === FILE_TYPE.dir) {
                const key = path.posix.join(dir, entry.name);
                this.memoryCache.delete(authUser.id, key);
                this.directoryCache.delete(authUser.id, key);
            }
        }

        return this.dir({ dir, authUser });
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
     * Caches and watches a directory version
     *
     * @param {string} params.dir Directory path
     * @param {Object} params.authUser Authenticated user
     * @param {Object[]} [params.entries] Directory entries to hash
     * @param {string} [params.hash] Previously calculated directory hash
     */
    async #watchDirectory({ dir, authUser, entries, hash }) {
        const ownerId = authUser.id;
        const watching = this.directoryCache.has(ownerId, dir);
        const directoryHash = hash ?? hashDirectory(entries);
        this.directoryCache.set(ownerId, dir, { username: authUser.username, hash: directoryHash });
        if (!watching) {
            setTimeout(() => this.#checkDirectory(ownerId, dir), directoryCheckTimeout);
        }

        return directoryHash;
    }

    async #checkDirectory(ownerId, dir) {
        const cachedDirectory = this.directoryCache.get(ownerId, dir);
        if (!cachedDirectory) {
            return;
        }

        try {
            const entries = await this.ftpService.dir({ dir, authUser: { username: cachedDirectory.username } });
            const hash = hashDirectory(entries);
            if (hash !== cachedDirectory.hash) {
                this.directoryCache.set(ownerId, dir, { ...cachedDirectory, hash });
            }
        } catch {}

        if (this.directoryCache.has(ownerId, dir)) {
            setTimeout(() => this.#checkDirectory(ownerId, dir), directoryCheckTimeout);
        }
    }

    async #moveCachedDirectory(ownerId, sourceKey, destinationKey) {
        const bufferMap = this.memoryCache.get(ownerId, sourceKey);
        const directory = this.directoryCache.get(ownerId, sourceKey);
        this.memoryCache.delete(ownerId, sourceKey);
        this.directoryCache.delete(ownerId, sourceKey);
        if (bufferMap !== undefined) {
            this.memoryCache.set(ownerId, destinationKey, bufferMap);
        }

        if (directory !== undefined) {
            await this.#watchDirectory({
                dir: destinationKey,
                authUser: { id: ownerId, username: directory.username },
                hash: directory.hash
            });
        }
    }
}

const { handleApiErrors } = ValidateUtils;
const { ftpThumbnailNotFound } = API_ERROR;
const hashAlgorithm = "sha256";
const directoryCheckTimeout = 5000;

function hashDirectory(entries) {
    const source = entries
        .map(({ name, size, modifyTime, type }) => `${name}:${size}:${modifyTime}:${type}`)
        .sort()
        .join("|");
    return createHash(hashAlgorithm).update(source).digest("hex");
}
