import { randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { finished, pipeline } from "node:stream/promises";
import path from "node:path";
import ApiError from "../utils/error/api-error.js";
import { FILE_TYPE } from "../config/constants.js";
import { API_ERROR } from "../config/errors.js";
import { ENV } from "../config/environment.js";

const {
    ftpMediaSessionTimeout: MEDIA_SESSION_TIMEOUT,
    ftpTransferSessionTimeout: TRANSFER_SESSION_TIMEOUT,
    ftpMaxUploadChunkSize: MAX_UPLOAD_CHUNK_SIZE,
    ftpMaxThumbnailSize: MAX_THUMBNAIL_SIZE,
    thumbnailGeneratorUrl
} = ENV;
const { dir: dirType, file: fileType } = FILE_TYPE;
const {
    ftpUploadFailed,
    ftpUploadChunkTooLarge,
    ftpUploadSizeExceeded,
    ftpDownloadFailed,
    ftpDownloadStale,
    ftpDirFailed,
    ftpMkdirFailed,
    ftpMoveFailed,
    ftpRenameFailed,
    ftpDeleteFailed,
    ftpThumbnailFailed,
    ftpThumbnailTooLarge,
    ftpFileRequired
} = API_ERROR;

/**
 * FTP service
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpService {
    #transferSessions = new Map();
    #mediaSessions = new Map();

    constructor({ ftpConnectionManager }) {
        this.ftpConnectionManager = ftpConnectionManager;
    }

    /**
     * Returns whether a user's pooled session accepts internal work
     *
     * @param {string} params.ownerId User identifier
     * @returns {boolean} Whether internal work may continue
     */
    isSessionActive({ ownerId }) {
        return this.ftpConnectionManager.isActive({ ownerId });
    }

    /**
     * Registers user activity served without an FTP operation
     *
     * @param {Object} params.authUser Authenticated user
     */
    async touchSession({ authUser }) {
        try {
            await this.ftpConnectionManager.touch({ authUser });
        } catch {
            FtpService.#ftpError({ message: "Error al preparar la sesión FTP", apiError: ftpDirFailed });
        }
    }

    /**
     * Returns FTP directory content
     *
     * @param {string} params.dir FTP directory path
     * @param {Object} params.authUser Authenticated user
     * @param {boolean} [params.internal] Whether this is an internal hash check
     * @returns {Promise<Object[] | undefined>} Directory resources, or undefined when an internal check is omitted
     */
    async dir({ dir, authUser, internal = false }) {
        try {
            return await this.ftpConnectionManager.execute({
                authUser,
                pool: internal ? "internal" : "read",
                paths: [dir],
                skipLocked: internal,
                callback: ({ client }) => client.list(dir)
            });
        } catch (err) {
            FtpService.#ftpError({ message: "Error al listar la carpeta", apiError: ftpDirFailed });
        }
    }

    /**
     * Generates image and video thumbnails from a FTP directory
     *
     * @param {string} params.dir FTP directory path
     * @param {string[]} params.names File names
     * @param {Object} params.authUser Authenticated user
     * @param {(source: { name: string, thumbnail: Buffer | null }) => Promise<void>} params.callback Thumbnail processor
     */
    async getThumbnails({ dir, names, authUser, callback }) {
        try {
            return await this.ftpConnectionManager.execute({
                authUser,
                pool: "read",
                transfer: true,
                paths: names.map((name) => path.posix.join(dir, name)),
                callback: async ({ client }) => {
                    await Promise.all(names.map(async (name) => {
                        let thumbnail;
                        try {
                            const remotePath = path.posix.join(dir, name);
                            const { size } = await client.stat(remotePath);
                            thumbnail = await this.#createThumbnail({ client, remotePath, size });
                        } catch {
                            thumbnail = null;
                        }
                        await callback({ name, thumbnail });
                    }));
                }
            });
        } catch {
            return FtpService.#ftpError({ message: "Error al generar las miniaturas", apiError: ftpThumbnailFailed });
        }
    }

    /**
     * Streams a temporary media session range
     *
     * @param {string} params.id Media session identifier
     * @param {string | undefined} params.range Requested byte range
     * @param {string} params.method HTTP method
     * @param {import("node:http").ServerResponse} params.stream HTTP response
     */
    async streamMedia({ id, range, method, stream }) {
        const session = this.#mediaSessions.get(id);
        if (!session) {
            stream.statusCode = 204;
            stream.end();
            return;
        }

        const { size, createReadStream } = session;
        const { start, end, partial } = FtpService.#getRange({ source: range, size });
        if (start > end || start >= size) {
            stream.writeHead(416, { "Content-Range": `bytes */${size}` });
            stream.end();
            return;
        }

        const headers = { "Accept-Ranges": "bytes", "Content-Length": end - start + 1 };
        if (partial) {
            headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
        }

        stream.writeHead(partial ? 206 : 200, headers);
        if (method === "HEAD") {
            stream.end();
            return;
        }

        await pipeline(createReadStream({ start, end }), stream);
    }

    /**
     * Creates a FTP directory
     *
     * @param {string} params.dir FTP directory path
     * @param {string} params.name Directory name
     * @param {Object} params.authUser Authenticated user
     */
    async makeDir({ dir, name, authUser }) {
        try {
            let remotePath = await this.#getAvailableRemotePath({ dir, name, authUser });
            while (true) {
                const collision = await this.ftpConnectionManager.execute({
                    authUser,
                    pool: "write",
                    paths: [remotePath],
                    callback: async ({ client }) => {
                        if (await client.exists(remotePath)) {
                            return true;
                        }

                        try {
                            const result = await client.mkdir(remotePath);
                            return result.endsWith(" already exists");
                        } catch (error) {
                            if (await client.exists(remotePath)) {
                                return true;
                            }

                            throw error;
                        }
                    }
                });
                if (!collision) {
                    return;
                }

                remotePath = await this.#getAvailableRemotePath({ dir, name, authUser });
            }
        } catch (err) {
            FtpService.#ftpError({ message: "Error al crear la carpeta", apiError: ftpMkdirFailed });
        }
    }

    /**
     * Moves FTP resources
     *
     * @param {string} params.dir Source FTP directory path
     * @param {Object[]} params.entries Resources to move
     * @param {string} params.destination Destination FTP directory path
     * @param {Object} params.authUser Authenticated user
     * @param {(entry: Object, newName: string) => Promise<void>} params.onEntry Handles each moved resource
     * @param {() => Promise<void>} [params.onComplete] Processes the destination before releasing locks
     */
    async move({ dir, entries, destination, authUser, onEntry, onComplete = async () => {} }) {
        let releaseSources;
        const releaseDestinations = [];
        try {
            releaseSources = await this.ftpConnectionManager.lockTransfer({
                authUser,
                paths: entries.map((entry) => path.posix.join(dir, entry.name)),
                sharedPaths: [...FtpService.#getParentPaths({ dir }), ...FtpService.#getParentPaths({ dir: destination })],
                treePaths: entries.filter((entry) => entry.type === dirType).map((entry) => path.posix.join(dir, entry.name))
            });
            const movedNames = [];
            for (const item of entries) {
                const sourcePath = path.posix.join(dir, item.name);
                let destinationPath = await this.#getAvailableRemotePath({
                    dir: destination,
                    name: item.name,
                    reservedNames: movedNames,
                    authUser
                });
                while (true) {
                    const releaseDestination = await this.ftpConnectionManager.lockTransfer({
                        authUser,
                        paths: [destinationPath],
                        sharedPaths: [],
                        treePaths: item.type === dirType ? [destinationPath] : []
                    });
                    let collision;
                    try {
                        collision = await this.ftpConnectionManager.execute({
                            authUser,
                            pool: "write",
                            callback: ({ client }) => FtpService.#renameAvailable({ client, sourcePath, destinationPath })
                        });
                    } catch (error) {
                        releaseDestination();
                        throw error;
                    }
                    if (!collision) {
                        releaseDestinations.push(releaseDestination);
                        break;
                    }

                    releaseDestination();
                    destinationPath = await this.#getAvailableRemotePath({
                        dir: destination,
                        name: item.name,
                        reservedNames: movedNames,
                        authUser
                    });
                }
                const movedName = path.posix.basename(destinationPath);
                movedNames.push(movedName);
                await onEntry(item, movedName);
            }
            await onComplete();
        } catch (err) {
            FtpService.#ftpError({ message: "Error al mover los archivos", apiError: ftpMoveFailed });
        } finally {
            releaseDestinations.forEach((release) => release());
            releaseSources?.();
        }
    }

    /**
     * Renames a FTP resource
     *
     * @param {string} params.dir FTP directory path
     * @param {Object} params.entry Resource to rename
     * @param {string} params.newName New resource name
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<Object>} Renamed resource
     */
    async rename({ dir, entry, newName, authUser }) {
        try {
            const sourcePath = path.posix.join(dir, entry.name);
            let destinationPath = await this.#getAvailableRemotePath({ dir, name: newName, authUser });
            while (await this.ftpConnectionManager.execute({
                authUser,
                pool: "write",
                paths: [sourcePath, destinationPath],
                treePaths: entry.type === dirType ? [sourcePath, destinationPath] : [],
                callback: ({ client }) => FtpService.#renameAvailable({ client, sourcePath, destinationPath })
            })) {
                destinationPath = await this.#getAvailableRemotePath({ dir, name: newName, authUser });
            }
            return { ...entry, name: path.posix.basename(destinationPath) };
        } catch (err) {
            FtpService.#ftpError({ message: "Error al renombrar", apiError: ftpRenameFailed });
        }
    }

    /**
     * Creates an upload session and its directory structure
     *
     * @param {string} params.dir Destination FTP directory
     * @param {{ path: string, type: string, size?: number }[]} params.entries Upload entries
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ id: string, entries: { path: string, type: string, size?: number }[] }>} Upload session
     */
    async createUpload({ dir, entries, authUser }) {
        const id = randomUUID();
        const session = {
            type: "UPLOAD",
            dir,
            ownerId: authUser.id,
            entries: new Map(),
            createdDirs: new Set(),
            fileLocks: [],
            activeStreams: new Set()
        };
        try {
            session.releaseLocks = await this.ftpConnectionManager.lockTransfer({
                authUser,
                paths: [],
                sharedPaths: FtpService.#getParentPaths({ dir }),
                treePaths: []
            });
            return await this.ftpConnectionManager.execute({
                authUser,
                pool: "write",
                paths: [`\0upload:${dir}`],
                callback: async ({ client }) => {
                    await FtpService.#trackMissingDirectories({ client, remoteDir: dir, directories: session.createdDirs });
                    await client.mkdir(dir, true);
                    const list = await client.list(dir);
                    const roots = new Map();
                    const resolvedEntries = entries.map((entry) => {
                        const [root, ...rest] = entry.path.split("/");
                        if (!roots.has(root)) {
                            const name = FtpService.#getAvailableName({ name: root, list });
                            roots.set(root, name);
                            list.push({ name });
                        }

                        return { ...entry, path: path.posix.join(roots.get(root), ...rest) };
                    });
                    session.protectedDirs = [...new Set(resolvedEntries.filter((entry) =>
                        entry.type === dirType || entry.path.includes("/")
                    ).map((entry) => path.posix.join(dir, entry.path.split("/")[0])))];
                    session.releaseEntryLocks = await this.ftpConnectionManager.lockTransfer({
                        authUser, paths: [], sharedPaths: [], treePaths: session.protectedDirs
                    });
                    for (const entry of resolvedEntries.filter(({ type }) => type === dirType)) {
                        const remoteDir = path.posix.join(dir, entry.path);
                        await FtpService.#trackMissingDirectories({ client, remoteDir, directories: session.createdDirs });
                        await client.mkdir(remoteDir, true);
                    }

                    const sessionEntries = resolvedEntries.map((entry) => {
                        if (entry.type === dirType) {
                            return [entry.path, { ...entry, uploaded: true }];
                        }

                        return [entry.path, { ...entry, receivedBytes: 0, uploaded: false, uploading: false }];
                    });
                    const timeout = setTimeout(() => void this.#expireTransfer({ id }), TRANSFER_SESSION_TIMEOUT);
                    timeout.unref();
                    session.timeout = timeout;
                    session.entries = new Map(sessionEntries);
                    this.#transferSessions.set(id, session);
                    return { id, entries: resolvedEntries };
                }
            });
        } catch (err) {
            await this.#cleanupTransfer({ session });
            FtpService.#ftpError({ message: "Error al preparar la subida", apiError: ftpUploadFailed });
        }
    }

    /**
     * Uploads one session file to SFTP
     *
     * @param {string} params.id Upload session identifier
     * @param {string} params.entryPath Relative file path
     * @param {number | undefined} params.offset Chunk byte offset
     * @param {{ originalname: string, mimetype: string, stream: import("node:stream").Readable }} params.file Uploaded file
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ nextOffset: number }>} Next expected byte offset
     */
    async upload({ id, entryPath, offset = 0, file, authUser }) {
        ApiError.handle([
            { condition: !file, message: "Debe proporcionar un archivo", status: 400, apiError: ftpFileRequired }
        ]);
        const session = this.#getTransferSession({ id, type: "UPLOAD", ownerId: authUser.id });
        const entry = session.entries.get(entryPath);
        ApiError.handle([{
            condition: !entry || entry.type !== fileType,
            message: "El archivo no pertenece a la subida",
            status: 400,
            apiError: ftpUploadFailed
        }, {
            condition: entry?.uploading,
            message: "Ya se está subiendo un fragmento del archivo",
            status: 409,
            apiError: ftpUploadFailed
        }, {
            condition: entry && offset !== entry.receivedBytes,
            message: `Offset no válido, se esperaba ${entry?.receivedBytes}`,
            status: 409,
            apiError: ftpUploadFailed
        }]);
        let destination;
        entry.uploading = true;
        session.activeStreams.add(file.stream);
        try {
            let remotePath = entry.remotePath ?? await this.#getAvailableRemotePath({
                dir: path.posix.join(session.dir, path.posix.dirname(entryPath)),
                name: path.posix.basename(entryPath),
                protectedPath: true,
                authUser
            });
            while (true) {
                const protectedByDirectory = session.protectedDirs.some((dir) =>
                    remotePath === dir || remotePath.startsWith(`${dir}/`));
                const releaseFile = !entry.remotePath && !protectedByDirectory
                    ? await this.ftpConnectionManager.lockTransfer({ authUser, paths: [remotePath], sharedPaths: [], treePaths: [] })
                    : undefined;
                if (releaseFile) {
                    session.fileLocks.push(releaseFile);
                }

                const result = await this.ftpConnectionManager.execute({
                    authUser,
                    pool: "write",
                    transfer: true,
                    callback: async ({ client }) => {
                        if (!entry.remotePath) {
                            try {
                                await client.put(Buffer.alloc(0), remotePath, { writeStreamOptions: { flags: "wx" } });
                            } catch (error) {
                                if (await client.exists(remotePath)) {
                                    return { collision: true };
                                }

                                throw error;
                            }
                            entry.remotePath = remotePath;
                        }

                        destination = client.createWriteStream(entry.remotePath, { flags: "r+", start: offset });
                        session.activeStreams.add(destination);
                        const counter = FtpService.#createChunkCounter({ entry, offset, maxSize: MAX_UPLOAD_CHUNK_SIZE });
                        await pipeline(file.stream, counter, destination);
                        entry.receivedBytes = counter.size;
                        entry.uploaded = entry.size === undefined || entry.receivedBytes === entry.size;
                        return { nextOffset: entry.receivedBytes };
                    }
                });
                if (!result.collision) {
                    return result;
                }

                releaseFile?.();

                remotePath = await this.#getAvailableRemotePath({
                    dir: path.posix.join(session.dir, path.posix.dirname(entryPath)),
                    name: path.posix.basename(entryPath),
                    protectedPath: true,
                    authUser
                });
            }
        } catch (err) {
            clearTimeout(session.timeout);
            this.#transferSessions.delete(id);
            await this.#cleanupTransfer({ session });
            FtpService.#ftpError({ message: "Error al subir los datos", apiError: ftpUploadFailed });
        } finally {
            entry.uploading = false;
            session.activeStreams.delete(file.stream);
            session.activeStreams.delete(destination);
        }
    }

    /**
     * Completes an upload session
     *
     * @param {string} params.id Upload session identifier
     * @param {Object} params.authUser Authenticated user
     * @param {(source: { dir: string }) => Promise<*>} [params.onComplete] Processes the uploaded directory before releasing its locks
     * @returns {Promise<*>} Completion result
     */
    async completeUpload({ id, authUser, onComplete = async ({ dir }) => ({ dir }) }) {
        const session = this.#getTransferSession({ id, type: "UPLOAD", ownerId: authUser.id });
        ApiError.handle([{
            condition: [...session.entries.values()].some(({ uploaded, uploading }) => !uploaded || uploading),
            message: "La subida contiene archivos pendientes",
            status: 409,
            apiError: ftpUploadFailed
        }]);
        clearTimeout(session.timeout);
        this.#transferSessions.delete(id);
        try {
            return await onComplete({ dir: session.dir });
        } finally {
            session.fileLocks.forEach((release) => release());
            session.releaseEntryLocks?.();
            session.releaseLocks?.();
        }
    }

    /**
     * Cancels a transfer session
     *
     * @param {string} params.id Transfer session identifier
     * @param {Object} params.authUser Authenticated user
     */
    async cancelTransfer({ id, authUser }) {
        const session = this.#getTransferSession({ id, ownerId: authUser.id });
        clearTimeout(session.timeout);
        this.#transferSessions.delete(id);
        await this.#cleanupTransfer({ session });
    }

    /**
     * Creates a recursive download manifest
     *
     * @param {string} params.dir Source FTP directory
     * @param {{ name: string, type: string }[]} params.entries FTP entries
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ id: string, totalBytes: number, entries: { path: string, type: string, size?: number }[] }>} Download session
     */
    async createDownload({ dir, entries, authUser }) {
        const id = randomUUID();
        let releaseLocks;
        try {
            releaseLocks = await this.ftpConnectionManager.lockTransfer({
                authUser,
                paths: entries.map((entry) => path.posix.join(dir, entry.name)),
                sharedPaths: FtpService.#getParentPaths({ dir }),
                treePaths: entries.filter((entry) => entry.type === dirType).map((entry) => path.posix.join(dir, entry.name))
            });
            return await this.ftpConnectionManager.execute({
                authUser,
                pool: "read",
                callback: async ({ client }) => {
                    const resolvedEntries = [];
                    let totalBytes = 0;
                    for await (const entry of FtpService.#createDownloadEntries({ client, remoteDir: dir, entries })) {
                        const resolvedEntry = entry.type === fileType
                            ? { path: entry.name, type: entry.type, size: entry.size }
                            : { path: entry.name, type: entry.type };
                        totalBytes += entry.size ?? 0;
                        ApiError.handle([{
                            condition: !Number.isSafeInteger(totalBytes),
                            message: "El tamaño total de la descarga supera el máximo permitido",
                            status: 400,
                            apiError: ftpDownloadFailed
                        }]);
                        resolvedEntries.push(resolvedEntry);
                    }
                    const timeout = setTimeout(() => void this.#expireTransfer({ id }), TRANSFER_SESSION_TIMEOUT);
                    timeout.unref();
                    this.#transferSessions.set(id, {
                        type: "DOWNLOAD",
                        dir,
                        ownerId: authUser.id,
                        timeout,
                        releaseLocks,
                        entries: resolvedEntries,
                        completedEntries: new Set(),
                        activeDownloads: 0,
                        activeStreams: new Set()
                    });
                    if (!resolvedEntries.some((entry) => entry.type === fileType)) {
                        releaseLocks();
                        this.#transferSessions.get(id).releaseLocks = undefined;
                    }

                    return { id, totalBytes, entries: resolvedEntries };
                }
            });
        } catch (err) {
            releaseLocks?.();
            FtpService.#ftpError({ message: "Error al preparar la descarga", apiError: ftpDownloadFailed });
        }
    }

    /**
     * Downloads one session file from SFTP
     *
     * @param {string} params.id Download session identifier
     * @param {string} params.entryPath Relative file path
     * @param {number | undefined} params.offset Requested byte offset
     * @param {Object} params.authUser Authenticated user
     * @param {import("node:stream").Writable} params.stream Download destination
     */
    async download({ id, entryPath, offset = 0, authUser, stream }) {
        const session = this.#getTransferSession({ id, type: "DOWNLOAD", ownerId: authUser.id });
        const entry = session.entries.find(({ path: currentPath, type }) => currentPath === entryPath && type === fileType);
        ApiError.handle([{
            condition: !entry,
            message: "El archivo no pertenece a la descarga",
            status: 400,
            apiError: ftpDownloadFailed
        }, {
            condition: entry && offset > entry.size,
            message: "El offset supera el tamaño del archivo",
            status: 416,
            apiError: ftpDownloadFailed
        }]);
        let source;
        session.activeDownloads += 1;
        try {
            await this.ftpConnectionManager.execute({
                authUser,
                pool: "read",
                transfer: true,
                paths: session.releaseLocks ? [] : [path.posix.join(session.dir, entryPath)],
                callback: async ({ client }) => {
                    const remotePath = path.posix.join(session.dir, entryPath);
                    let size;
                    try {
                        ({ size } = await client.stat(remotePath));
                    } catch {
                        throw FtpService.#createStaleDownloadError();
                    }
                    if (size !== entry.size) {
                        throw FtpService.#createStaleDownloadError();
                    }

                    const remainingSize = entry.size - offset;
                    stream.setHeader?.("Content-Length", remainingSize);
                    if (!remainingSize) {
                        stream.end();
                        await finished(stream, { readable: false });
                        return;
                    }

                    source = client.createReadStream(remotePath, { start: offset });
                    session.activeStreams.add(source);
                    session.activeStreams.add(stream);
                    await pipeline(source, FtpService.#createSizeValidator({ expectedSize: remainingSize }), stream);
                }
            });
            session.completedEntries.add(entryPath);
        } catch (err) {
            clearTimeout(session.timeout);
            this.#transferSessions.delete(id);
            await this.#cleanupTransfer({ session });
            if (err.code === ftpDownloadStale) {
                throw err;
            }

            FtpService.#ftpError({ message: "Error al descargar", apiError: ftpDownloadFailed });
        } finally {
            session.activeStreams.delete(source);
            session.activeStreams.delete(stream);
            session.activeDownloads -= 1;
            if (!session.activeDownloads && session.releaseLocks && session.entries
                .filter((item) => item.type === fileType).every((item) => session.completedEntries.has(item.path))) {
                session.releaseLocks();
                session.releaseLocks = undefined;
            }
        }
    }

    /**
     * Deletes FTP resources
     *
     * @param {string} params.dir FTP directory path
     * @param {Object[]} params.entries Resources to delete
     * @param {Object} params.authUser Authenticated user
     * @param {(entry: Object) => Promise<void>} params.onEntry Handles each deleted resource
     * @param {() => Promise<void>} [params.onComplete] Processes the directory before releasing locks
     */
    async delete({ dir, entries, authUser, onEntry, onComplete = async () => {} }) {
        try {
            return await this.ftpConnectionManager.execute({
                authUser,
                pool: "write",
                paths: entries.map((entry) => path.posix.join(dir, entry.name)),
                sharedPaths: FtpService.#getParentPaths({ dir }),
                treePaths: entries.filter((entry) => entry.type === dirType).map((entry) => path.posix.join(dir, entry.name)),
                callback: async ({ client }) => {
                    for (const entry of entries) {
                        const { name, type } = entry;
                        const remotePath = `${dir}/${name}`;
                        if (type === dirType) {
                            await client.rmdir(remotePath, true);
                        } else {
                            await client.delete(remotePath);
                        }

                        await onEntry(entry);
                    }
                    await onComplete();
                }
            });
        } catch (err) {
            FtpService.#ftpError({ message: "Error al borrar", apiError: ftpDeleteFailed });
        }
    }

    /**
     * Creates a thumbnail through a temporary seekable media session
     *
     * @param {import("ssh2-sftp-client")} params.client SFTP client
     * @param {string} params.remotePath Remote media path
     * @param {number} params.size Media size in bytes
     * @returns {Promise<Buffer | null>} JPEG thumbnail
     */
    async #createThumbnail({ client, remotePath, size }) {
        if (!size) {
            return null;
        }

        const id = randomUUID();
        const timeout = setTimeout(() => this.#mediaSessions.delete(id), MEDIA_SESSION_TIMEOUT);
        this.#mediaSessions.set(id, {
            size,
            createReadStream: ({ start, end }) => client.createReadStream(remotePath, { start, end })
        });
        try {
            const response = await fetch(`${thumbnailGeneratorUrl}/thumbnail/${id}`, {
                method: "POST",
                signal: AbortSignal.timeout(MEDIA_SESSION_TIMEOUT)
            });
            if (!response.ok) {
                return null;
            }

            return FtpService.#readResponseBuffer(response, MAX_THUMBNAIL_SIZE);
        } finally {
            clearTimeout(timeout);
            this.#mediaSessions.delete(id);
        }
    }

    /**
     * Reads a response without exceeding the allowed buffer size
     *
     * @param {Response} response HTTP response
     * @param {number} maxSize Maximum response size in bytes
     * @returns {Promise<Buffer>} Response buffer
     */
    static async #readResponseBuffer(response, maxSize) {
        const contentLength = Number(response.headers.get("content-length"));
        ApiError.handle([{
            condition: contentLength > maxSize,
            message: "La miniatura supera el tamaño permitido",
            status: 413,
            apiError: ftpThumbnailTooLarge
        }]);

        const chunks = [];
        let size = 0;
        for await (const chunk of response.body) {
            size += chunk.length;
            ApiError.handle([{
                condition: size > maxSize,
                message: "La miniatura supera el tamaño permitido",
                status: 413,
                apiError: ftpThumbnailTooLarge
            }]);

            chunks.push(chunk);
        }

        return Buffer.concat(chunks, size);
    }

    /**
     * Returns download entries preserving their relative paths
     *
     * @param {import("ssh2-sftp-client")} params.client SFTP client
     * @param {string} params.remoteDir Remote directory path
     * @param {Object[]} params.entries Directory entries
     * @param {string} [params.relativeDir] Relative download path
     * @returns {AsyncGenerator<{ name: string, type: string, remotePath: string, size?: number }>} Download entries
     */
    static async *#createDownloadEntries({ client, remoteDir, entries, relativeDir = "." }) {
        for (const entry of entries) {
            const name = path.posix.join(relativeDir, entry.name);
            const remotePath = path.posix.join(remoteDir, entry.name);
            const type = ["d", dirType].includes(entry.type) ? dirType : fileType;
            let size;
            if (type === fileType) {
                ({ size } = await client.stat(remotePath));
                ApiError.handle([{
                    condition: !Number.isSafeInteger(size) || size < 0,
                    message: "El tamaño del archivo no es válido",
                    status: 400,
                    apiError: ftpDownloadFailed
                }]);
            }
            yield { name, type, remotePath, ...(type === fileType && { size }) };
            if (type === dirType) {
                yield* FtpService.#createDownloadEntries({
                    client,
                    remoteDir,
                    entries: await client.list(remotePath),
                    relativeDir: name
                });
            }
        }
    }

    static #getRange({ source, size }) {
        const range = source?.match(/^bytes=(\d*)-(\d*)$/);
        if (!range) {
            return { start: 0, end: size - 1, partial: false };
        }

        if (!range[1]) {
            const length = Math.min(Number(range[2]), size);
            return { start: size - length, end: size - 1, partial: true };
        }

        const start = Number(range[1]);
        const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        return { start, end, partial: true };
    }

    /**
     * Returns the first available resource name
     *
     * @param {string} params.name Requested resource name
     * @param {{ name: string }[]} params.list Existing FTP resources
     * @returns {string} Available resource name
     */
    static #getAvailableName({ name, list }) {
        if (!list.some(({ name: currentName }) => currentName === name)) {
            return name;
        }

        const extension = path.posix.extname(name);
        const baseName = path.posix.basename(name, extension).replace(/ \(\d+\)$/, "");
        let copy = 1;
        while (list.some(({ name: currentName }) => currentName === `${baseName} (${copy})${extension}`)) {
            copy += 1;
        }

        return `${baseName} (${copy})${extension}`;
    }

    /**
     * Creates a transform that validates and counts an upload chunk
     *
     * @param {{ size?: number }} params.entry Upload entry
     * @param {number} params.offset Chunk start offset
     * @param {number} params.maxSize Maximum chunk size
     * @returns {Transform & { size: number }} Upload chunk counter
     */
    static #createChunkCounter({ entry, offset, maxSize }) {
        let chunkSize = 0;
        const counter = new Transform({
            transform(chunk, encoding, callback) {
                chunkSize += chunk.length;
                const receivedBytes = offset + chunkSize;
                if (maxSize > 0 && chunkSize > maxSize) {
                    callback(new ApiError({
                        message: "El fragmento supera el tamaño permitido",
                        status: 413,
                        apiError: ftpUploadChunkTooLarge
                    }));
                    return;
                }

                if (entry.size !== undefined && receivedBytes > entry.size) {
                    callback(new ApiError({
                        message: "El archivo supera el tamaño declarado",
                        status: 413,
                        apiError: ftpUploadSizeExceeded
                    }));
                    return;
                }

                counter.size = receivedBytes;
                callback(null, chunk);
            }
        });
        counter.size = offset;
        return counter;
    }

    /**
     * Creates a transform that validates a complete download size
     *
     * @param {number} params.expectedSize Expected file size
     * @returns {Transform} Download size validator
     */
    static #createSizeValidator({ expectedSize }) {
        let size = 0;
        return new Transform({
            transform(chunk, encoding, callback) {
                size += chunk.length;
                callback(size > expectedSize ? FtpService.#createStaleDownloadError() : null, chunk);
            },
            flush(callback) {
                callback(size === expectedSize ? null : FtpService.#createStaleDownloadError());
            }
        });
    }

    static #createStaleDownloadError() {
        return new ApiError({
            message: "El archivo ha cambiado desde que se creó la sesión",
            status: 409,
            apiError: ftpDownloadStale
        });
    }

    /**
     * Returns an active transfer session owned by a user
     *
     * @param {string} params.id Transfer session identifier
     * @param {"UPLOAD" | "DOWNLOAD" | undefined} params.type Expected transfer type
     * @param {string} params.ownerId User identifier
     * @returns {Object} Transfer session
     */
    #getTransferSession({ id, type, ownerId }) {
        const session = this.#transferSessions.get(id);
        ApiError.handle([{
            condition: !session || session.ownerId !== ownerId || (type && session.type !== type),
            message: "Sesión de transferencia no válida",
            status: 404,
            apiError: type === "DOWNLOAD" ? ftpDownloadFailed : ftpUploadFailed
        }]);
        return session;
    }

    async #expireTransfer({ id }) {
        const session = this.#transferSessions.get(id);
        this.#transferSessions.delete(id);
        await this.#cleanupTransfer({ session });
    }

    /**
     * Resolves an available remote path under an FTP directory
     *
     * @param {string} params.dir FTP directory path
     * @param {string} params.name Requested resource name
     * @param {string[]} [params.reservedNames] Names reserved by the current operation
     * @param {boolean} [params.protectedPath] Whether the parent directory is already protected
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<string>} Available remote path
     */
    async #getAvailableRemotePath({ dir, name, reservedNames = [], protectedPath = false, authUser }) {
        return this.ftpConnectionManager.execute({
            authUser,
            pool: "write",
            sharedPaths: protectedPath ? [] : [dir],
            callback: async ({ client }) => {
                const list = await client.list(dir);
                const resources = [...list, ...reservedNames.map((reservedName) => ({ name: reservedName }))];
                return path.posix.join(dir, FtpService.#getAvailableName({ name, list: resources }));
            }
        });
    }

    static #getParentPaths({ dir }) {
        const paths = [];
        let current = path.posix.normalize(dir);
        while (true) {
            paths.push(current);
            const parent = path.posix.dirname(current);
            if (parent === current) {
                return paths;
            }

            current = parent;
        }
    }

    static async #renameAvailable({ client, sourcePath, destinationPath }) {
        try {
            await client.rename(sourcePath, destinationPath);
            return false;
        } catch (error) {
            if (await client.exists(destinationPath)) {
                return true;
            }

            throw error;
        }
    }

    /**
     * Cleans resources created or locked by a transfer session
     *
     * @param {Object | undefined} params.session Transfer session
     */
    async #cleanupTransfer({ session }) {
        if (!session) {
            return;
        }

        for (const stream of session.activeStreams) {
            stream.destroy();
        }

        if (session.type !== "UPLOAD") {
            session.releaseLocks?.();
            return;
        }

        try {
            await this.ftpConnectionManager.execute({
                authUser: { id: session.ownerId },
                pool: "write",
                callback: async ({ client }) => {
                    for (const entry of session.entries.values()) {
                        if (entry.type !== fileType || !entry.remotePath) {
                            continue;
                        }

                        try {
                            await client.delete(entry.remotePath);
                        } catch {
                            continue;
                        }
                    }

                    const directories = [...session.createdDirs].sort((a, b) => b.split("/").length - a.split("/").length);
                    for (const remoteDir of directories) {
                        try {
                            await client.rmdir(remoteDir, false);
                        } catch {
                            continue;
                        }
                    }
                }
            });
        } catch {
            return;
        } finally {
            session.fileLocks.forEach((release) => release());
            session.releaseEntryLocks?.();
            session.releaseLocks?.();
        }
    }

    static async #trackMissingDirectories({ client, remoteDir, directories }) {
        let currentDir = remoteDir;
        while (![".", "/"].includes(currentDir) && !(await client.exists(currentDir))) {
            directories.add(currentDir);
            currentDir = path.posix.dirname(currentDir);
        }
    }

    static #ftpError({ message, apiError }) {
        ApiError.handle([{ condition: true, message, apiError }]);
    }
}
