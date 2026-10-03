import path from "node:path";
import { createHash } from "node:crypto";
import { FILE_TYPE } from "../config/constants.js";
import { API_ERROR } from "../config/errors.js";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * FTP facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpFacade {
    static #HASH_ALGORITHM = "sha256";
    static #DIRECTORY_CHECK_TIMEOUT = 5000;

    #thumbnailJobs = new Map();

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
        this.#syncThumbnails({ dir, entries: result, authUser });
        const hash = await this.#watchDirectory({ dir, authUser, entries: result });
        return { hash, data: this.ftpMapper.entriesToDomain(result) };
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
     * Streams a temporary FTP media resource
     *
     * @param {string} data.id Media session identifier
     * @param {string | undefined} data.range Requested byte range
     * @param {string} data.method HTTP method
     * @param {import("node:http").ServerResponse} data.stream HTTP response
     */
    async streamMedia(data) {
        await this.ftpService.streamMedia(data);
    }

    /**
     * Returns a cached FTP thumbnail
     *
     * @param {string} params.dir FTP directory path
     * @param {string} params.name File name
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<Buffer | null>} JPEG thumbnail, or null when unavailable
     */
    async getThumbnail({ dir, name, authUser }) {
        let bufferMap = this.memoryCache.get(authUser.id, dir);
        if (!bufferMap) {
            await this.dir({ dir, authUser });
            bufferMap = this.memoryCache.get(authUser.id, dir);
        }

        const thumbnail = bufferMap?.get(name);
        const thumbnailJobs = this.#thumbnailJobs.get(FtpFacade.#getThumbnailJobKey(authUser.id, dir));
        handleApiErrors([
            {
                condition: thumbnail === undefined && thumbnailJobs?.has(name),
                message: "La miniatura se está generando",
                status: 404,
                apiError: ftpThumbnailPending
            }
        ]);
        return thumbnail ?? null;
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
        this.#thumbnailJobs.delete(FtpFacade.#getThumbnailJobKey(authUser.id, dir));
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
     */
    async download(data) {
        const { entries, stream } = data;
        const [entry] = entries;
        let name = entry.name;
        let type = name;
        if (entries.length > 1 || entry.type === FILE_TYPE.dir) {
            name = `download-${Date.now()}.zip`;
            type = "application/zip";
        }

        stream.type(type).attachment(name);
        await this.ftpService.download(data);
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
                this.#thumbnailJobs.delete(FtpFacade.#getThumbnailJobKey(authUser.id, key));
            }
        }

        return this.dir({ dir, authUser });
    }

    /**
     * Synchronizes cached thumbnails with current FTP entries
     *
     * @param {string} params.dir FTP directory path
     * @param {Object[]} params.entries Current FTP entries
     * @param {Object} params.authUser Authenticated user
     */
    #syncThumbnails({ dir, entries, authUser }) {
        const names = entries.filter(({ supportsThumbnail }) => supportsThumbnail).map(({ name }) => name);
        const cachedBufferMap = this.memoryCache.get(authUser.id, dir);
        const bufferMap = new Map(cachedBufferMap);
        const removedNames = new Set(bufferMap.keys());
        const missingNames = names.filter((name) => !removedNames.delete(name));
        for (const name of removedNames) {
            bufferMap.delete(name);
        }

        if (!cachedBufferMap || removedNames.size) {
            this.memoryCache.set(authUser.id, dir, bufferMap);
        }

        const jobKey = FtpFacade.#getThumbnailJobKey(authUser.id, dir);
        const thumbnailJobs = this.#thumbnailJobs.get(jobKey) ?? new Set();
        const nameSet = new Set(names);
        for (const name of thumbnailJobs) {
            if (!nameSet.has(name)) {
                thumbnailJobs.delete(name);
            }
        }

        if (!thumbnailJobs.size) {
            this.#thumbnailJobs.delete(jobKey);
        }

        this.#queueThumbnails({ dir, names: missingNames, authUser, thumbnailJobs });
    }

    /**
     * Queues thumbnails that are not already being generated
     *
     * @param {string} params.dir FTP directory path
     * @param {string[]} params.names File names
     * @param {Object} params.authUser Authenticated user
     * @param {Set<string>} params.thumbnailJobs Pending thumbnail names
     */
    #queueThumbnails({ dir, names, authUser, thumbnailJobs = new Set() }) {
        const pendingNames = names.filter((name) => !thumbnailJobs.has(name));
        if (!pendingNames.length) {
            return;
        }

        const jobKey = FtpFacade.#getThumbnailJobKey(authUser.id, dir);
        pendingNames.forEach((name) => thumbnailJobs.add(name));
        this.#thumbnailJobs.set(jobKey, thumbnailJobs);
        void this.#getThumbnails({ dir, names: pendingNames, authUser, jobKey });
    }

    /**
     * Caches thumbnails as the FTP service generates them
     *
     * @param {string} params.dir FTP directory path
     * @param {string[]} params.names File names
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.jobKey Thumbnail job identifier
     */
    async #getThumbnails({ dir, names, authUser, jobKey }) {
        try {
            await this.ftpService.getThumbnails({
                dir,
                names,
                authUser,
                callback: async ({ name, thumbnail }) => {
                    const thumbnailJobs = this.#thumbnailJobs.get(jobKey);
                    if (!thumbnailJobs?.delete(name)) {
                        return;
                    }

                    const cachedBufferMap = this.memoryCache.get(authUser.id, dir);
                    if (cachedBufferMap) {
                        const bufferMap = new Map(cachedBufferMap);
                        bufferMap.set(name, thumbnail);
                        this.memoryCache.set(authUser.id, dir, bufferMap);
                    }

                    if (!thumbnailJobs.size) {
                        this.#thumbnailJobs.delete(jobKey);
                    }
                }
            });
        } catch {
            const thumbnailJobs = this.#thumbnailJobs.get(jobKey);
            names.forEach((name) => thumbnailJobs?.delete(name));
            if (!thumbnailJobs?.size) {
                this.#thumbnailJobs.delete(jobKey);
            }
        }
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
        const directoryHash = hash ?? FtpFacade.#hashDirectory(entries);
        this.directoryCache.set(ownerId, dir, { username: authUser.username, hash: directoryHash });
        if (!watching) {
            setTimeout(() => this.#checkDirectory(ownerId, dir), FtpFacade.#DIRECTORY_CHECK_TIMEOUT);
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
            const hash = FtpFacade.#hashDirectory(entries);
            if (hash !== cachedDirectory.hash) {
                this.directoryCache.set(ownerId, dir, { ...cachedDirectory, hash });
            }
        } catch {}

        if (this.directoryCache.has(ownerId, dir)) {
            setTimeout(() => this.#checkDirectory(ownerId, dir), FtpFacade.#DIRECTORY_CHECK_TIMEOUT);
        }
    }

    async #moveCachedDirectory(ownerId, sourceKey, destinationKey) {
        const bufferMap = this.memoryCache.get(ownerId, sourceKey);
        const directory = this.directoryCache.get(ownerId, sourceKey);
        const sourceJobKey = FtpFacade.#getThumbnailJobKey(ownerId, sourceKey);
        const names = [...(this.#thumbnailJobs.get(sourceJobKey) ?? [])];
        this.memoryCache.delete(ownerId, sourceKey);
        this.directoryCache.delete(ownerId, sourceKey);
        this.#thumbnailJobs.delete(sourceJobKey);
        if (bufferMap !== undefined) {
            this.memoryCache.set(ownerId, destinationKey, bufferMap);
        }

        if (directory !== undefined) {
            await this.#watchDirectory({
                dir: destinationKey,
                authUser: { id: ownerId, username: directory.username },
                hash: directory.hash
            });

            if (names.length) {
                this.#queueThumbnails({
                    dir: destinationKey,
                    names,
                    authUser: { id: ownerId, username: directory.username }
                });
            }
        }
    }

    static #getThumbnailJobKey(ownerId, dir) {
        return JSON.stringify([ownerId, dir]);
    }

    static #hashDirectory(entries) {
        const source = entries
            .map(({ name, size, modifyTime, type }) => `${name}:${size}:${modifyTime}:${type}`)
            .sort()
            .join("|");
        return createHash(FtpFacade.#HASH_ALGORITHM).update(source).digest("hex");
    }
}

const { handleApiErrors } = ValidateUtils;
const { ftpThumbnailPending } = API_ERROR;
