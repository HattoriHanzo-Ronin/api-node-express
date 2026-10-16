import path from "node:path";
import { createHash } from "node:crypto";
import { FILE_TYPE } from "../config/constants.js";
import { API_ERROR } from "../config/errors.js";
import ValidateUtils from "../utils/validate-utils.js";
import { ENV } from "../config/environment.js";

/**
 * FTP facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpFacade {
    static #HASH_ALGORITHM = "sha256";

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
     * @param {string} params.dir FTP directory path
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ hash: string, data: Object[] }>} Directory resources
     */
    async dir({ dir, authUser }) {
        const result = await this.ftpService.dir({ dir, authUser });
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
        await this.ftpService.touchSession({ authUser });
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
     * @param {string} params.id Media session identifier
     * @param {string | undefined} params.range Requested byte range
     * @param {string} params.method HTTP method
     * @param {import("node:http").ServerResponse} params.stream HTTP response
     */
    async streamMedia({ id, range, method, stream }) {
        await this.ftpService.streamMedia({ id, range, method, stream });
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
     * @param {string} params.dir FTP directory path
     * @param {string} params.name Directory name
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ hash: string, data: Object[] }>} Updated directory resources
     */
    async makeDir({ dir, name, authUser }) {
        await this.ftpService.makeDir({ dir, name, authUser });
        return this.dir({ dir, authUser });
    }

    /**
     * Moves FTP resources
     *
     * @param {string} params.dir Source FTP directory
     * @param {Object[]} params.entries Resources to move
     * @param {string} params.destination Destination FTP directory
     * @param {Object} params.authUser Authenticated user
     * @param {import("node:stream").Writable} params.stream Progress destination
     */
    async move({ dir, entries, destination, authUser, stream }) {
        let completed = 0;
        try {
            await this.ftpService.move({
                dir,
                entries,
                destination,
                authUser,
                onEntry: async (entry, newName) => {
                    completed += 1;
                    if (entry.type === FILE_TYPE.dir) {
                        await this.#moveCachedDirectory(
                            authUser.id,
                            path.posix.join(dir, entry.name),
                            path.posix.join(destination, newName)
                        );
                    }

                    await writeProgress(stream, {
                        event: "entry",
                        path: entry.name,
                        targetPath: newName,
                        type: entry.type,
                        completed,
                        total: entries.length
                    });
                }
            });
        } finally {
            this.#clearDirectoryCache(authUser.id, dir);
            this.#clearDirectoryCache(authUser.id, destination);
        }
        const { hash } = await this.dir({ dir: destination, authUser });
        await writeProgress(stream, { event: "complete", version: hash });
        stream.end();
    }

    /**
     * Renames a FTP resource
     *
     * @param {string} params.dir FTP directory path
     * @param {Object} params.entry Resource to rename
     * @param {string} params.newName New resource name
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ hash: string, data: Object[] }>} Updated directory resources
     */
    async rename({ dir, entry, newName, authUser }) {
        const renamedEntry = await this.ftpService.rename({ dir, entry, newName, authUser });
        if (entry.type === FILE_TYPE.dir) {
            await this.#moveCachedDirectory(
                authUser.id,
                path.posix.join(dir, entry.name),
                path.posix.join(dir, renamedEntry.name)
            );
        }

        return this.dir({ dir, authUser });
    }

    /**
     * Creates a FTP upload session
     *
     * @param {string} params.dir Destination FTP directory
     * @param {{ path: string, type: string }[]} params.entries Upload entries
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ id: string, entries: { path: string, type: string }[] }>} Upload session
     */
    async createUpload({ dir, entries, authUser }) {
        return this.ftpService.createUpload({ dir, entries, authUser });
    }

    /**
     * Uploads one file from a FTP upload session
     *
     * @param {string} params.id Upload session identifier
     * @param {string} params.entryPath Relative file path
     * @param {number | undefined} params.offset Chunk byte offset
     * @param {{ originalname: string, mimetype: string, stream: import("node:stream").Readable }} params.file Uploaded file
     * @param {Object} params.authUser Authenticated user
     */
    async uploadEntry({ id, entryPath, offset, file, authUser }) {
        return this.ftpService.upload({ id, entryPath, offset, file, authUser });
    }

    /**
     * Completes a FTP upload session
     *
     * @param {string} params.id Upload session identifier
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ hash: string, data: Object[] }>} Updated directory resources
     */
    async completeUpload({ id, authUser }) {
        const { dir } = await this.ftpService.completeUpload({ id, authUser });
        return this.dir({ dir, authUser });
    }

    /**
     * Cancels a FTP transfer session
     *
     * @param {string} params.id Transfer session identifier
     * @param {Object} params.authUser Authenticated user
     */
    async cancelTransfer({ id, authUser }) {
        await this.ftpService.cancelTransfer({ id, authUser });
    }

    /**
     * Creates a FTP download session
     *
     * @param {string} params.dir Source FTP directory
     * @param {{ name: string, type: string }[]} params.entries FTP entries
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ id: string, totalBytes: number, entries: { path: string, type: string, size?: number }[] }>} Download session
     */
    async createDownload({ dir, entries, authUser }) {
        return this.ftpService.createDownload({ dir, entries, authUser });
    }

    /**
     * Downloads one file from a FTP download session
     *
     * @param {string} params.id Download session identifier
     * @param {string} params.entryPath Relative file path
     * @param {number | undefined} params.offset Requested byte offset
     * @param {Object} params.authUser Authenticated user
     * @param {import("node:stream").Writable} params.stream Download destination
     */
    async downloadEntry({ id, entryPath, offset, authUser, stream }) {
        await this.ftpService.download({ id, entryPath, offset, authUser, stream });
    }

    /**
     * Deletes FTP resources
     *
     * @param {string} params.dir FTP directory
     * @param {Object[]} params.entries Resources to delete
     * @param {Object} params.authUser Authenticated user
     * @param {import("node:stream").Writable} params.stream Progress destination
     */
    async delete({ dir, entries, authUser, stream }) {
        let completed = 0;
        try {
            await this.ftpService.delete({
                dir,
                entries,
                authUser,
                onEntry: async (entry) => {
                    completed += 1;
                    if (entry.type === FILE_TYPE.dir) {
                        this.#clearDirectoryCache(authUser.id, path.posix.join(dir, entry.name));
                    }

                    await writeProgress(stream, {
                        event: "entry",
                        path: entry.name,
                        type: entry.type,
                        completed,
                        total: entries.length
                    });
                }
            });
        } finally {
            this.#clearDirectoryCache(authUser.id, dir);
        }
        const { hash } = await this.dir({ dir, authUser });
        await writeProgress(stream, { event: "complete", version: hash });
        stream.end();
    }

    #clearDirectoryCache(ownerId, dir) {
        this.memoryCache.delete(ownerId, dir);
        this.directoryCache.delete(ownerId, dir);
        this.#thumbnailJobs.delete(FtpFacade.#getThumbnailJobKey(ownerId, dir));
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
        this.directoryCache.set(ownerId, dir, { hash: directoryHash });
        if (!watching) {
            setTimeout(() => this.#checkDirectory(ownerId, dir), DIRECTORY_CHECK_TIMEOUT);
        }

        return directoryHash;
    }

    async #checkDirectory(ownerId, dir) {
        const cachedDirectory = this.directoryCache.get(ownerId, dir);
        if (!cachedDirectory) {
            return;
        }

        try {
            const entries = await this.ftpService.dir({
                dir,
                authUser: { id: ownerId },
                internal: true
            });
            if (!entries) {
                if (this.ftpService.isSessionActive({ ownerId })) {
                    setTimeout(() => this.#checkDirectory(ownerId, dir), DIRECTORY_CHECK_TIMEOUT);
                } else {
                    this.directoryCache.delete(ownerId, dir);
                }
                return;
            }
            const hash = FtpFacade.#hashDirectory(entries);
            if (hash !== cachedDirectory.hash) {
                this.directoryCache.set(ownerId, dir, { ...cachedDirectory, hash });
            }
        } catch {}

        if (this.directoryCache.has(ownerId, dir)) {
            setTimeout(() => this.#checkDirectory(ownerId, dir), DIRECTORY_CHECK_TIMEOUT);
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
                authUser: { id: ownerId },
                hash: directory.hash
            });

            if (names.length) {
                this.#queueThumbnails({
                    dir: destinationKey,
                    names,
                    authUser: { id: ownerId }
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
const { ftpDirectoryCheckTimeout: DIRECTORY_CHECK_TIMEOUT } = ENV;

function writeProgress(stream, progress) {
    if (!stream.headersSent) {
        stream.set?.({
            "Cache-Control": "no-cache, no-transform",
            "Content-Type": "application/x-ndjson",
            "X-Accel-Buffering": "no"
        });
    }

    return new Promise((resolve, reject) => {
        stream.write(`${JSON.stringify(progress)}\n`, (error) => error ? reject(error) : resolve());
    });
}
