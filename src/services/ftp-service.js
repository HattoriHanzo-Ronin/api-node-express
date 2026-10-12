import { randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import ValidateUtils from "../utils/validate-utils.js";
import ApiError from "../utils/error/api-error.js";
import FtpClient from "../utils/connection/ftp-client.js";
import { FILE_TYPE } from "../config/constants.js";
import { API_ERROR } from "../config/errors.js";
import { ENV } from "../config/environment.js";

/**
 * FTP service
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpService {
    static #MEDIA_SESSION_TIMEOUT = 60_000;
    static #TRANSFER_SESSION_TIMEOUT = 30 * 60_000;
    static #MAX_UPLOAD_CHUNK_SIZE = 0;
    static #MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024;
    static #MEDIA_EXTENSION = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic|heif|mp4|m4v|mov|mkv|webm|avi|mpeg|mpg|wmv|flv|3gp|mts|m2ts|ogv)$/i;
    static #mediaSessions = new Map();

    /**
     * Returns FTP directory content
     *
     * @param {string} params.dir FTP directory path
     * @param {{ username: string }} params.authUser Authenticated user
     * @returns {Promise<Object[]>} Directory resources
     */
    static async dir({ dir, authUser }) {
        let client;
        try {
            client = await getClient(authUser.username);
            const list = await client.list(dir);
            return list.map(({ name, type, size, modifyTime }) => {
                const normalizedType = type === "d" ? dirType : fileType;
                return {
                    name,
                    type: normalizedType,
                    size,
                    modifyTime,
                    supportsThumbnail: normalizedType === fileType && FtpService.#MEDIA_EXTENSION.test(path.extname(name))
                };
            });
        } catch (err) {
            ftpError("Error al listar la carpeta", ftpDirFailed);
        } finally {
            await closeClient(client);
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
    static async getThumbnails({ dir, names, authUser, callback }) {
        let client;
        try {
            client = await getClient(authUser.username);
            for (const name of names) {
                let thumbnail;
                try {
                    const remotePath = path.posix.join(dir, name);
                    const { size } = await client.stat(remotePath);
                    thumbnail = await FtpService.#createThumbnail({ client, remotePath, size });
                } catch {
                    thumbnail = null;
                }
                await callback({ name, thumbnail });
            }
        } finally {
            await closeClient(client);
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
    static async streamMedia({ id, range, method, stream }) {
        const session = FtpService.#mediaSessions.get(id);
        if (!session) {
            stream.statusCode = 204;
            stream.end();
            return;
        }

        const { size, createReadStream } = session;
        const { start, end, partial } = getRange(range, size);
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
     * @param {{ username: string }} params.authUser Authenticated user
     */
    static async makeDir({ dir, name, authUser }) {
        let client;
        try {
            client = await getClient(authUser.username);
            const list = await client.list(dir);
            const newName = getAvailableName(name, list);
            await client.mkdir(`${dir}/${newName}`);
        } catch (err) {
            ftpError("Error al crear la carpeta", ftpMkdirFailed);
        } finally {
            await closeClient(client);
        }
    }

    /**
     * Moves FTP resources
     *
     * @param {string} params.dir Source FTP directory path
     * @param {Object[]} params.entries Resources to move
     * @param {string} params.destination Destination FTP directory path
     * @param {{ username: string }} params.authUser Authenticated user
     * @param {(entry: Object, newName: string) => Promise<void>} params.onEntry Handles each moved resource
     */
    static async move({ dir, entries, destination, authUser, onEntry }) {
        let client;
        try {
            client = await getClient(authUser.username);
            const list = await client.list(destination);
            for (const item of entries) {
                const newName = getAvailableName(item.name, list);
                await client.rename(`${dir}/${item.name}`, `${destination}/${newName}`);
                list.push({ name: newName });
                await onEntry(item, newName);
            }
        } catch (err) {
            ftpError("Error al mover los archivos", ftpMoveFailed);
        } finally {
            await closeClient(client);
        }
    }

    /**
     * Renames a FTP resource
     *
     * @param {string} params.dir FTP directory path
     * @param {Object} params.entry Resource to rename
     * @param {string} params.newName New resource name
     * @param {{ username: string }} params.authUser Authenticated user
     * @returns {Promise<Object>} Renamed resource
     */
    static async rename({ dir, entry, newName, authUser }) {
        let client;
        try {
            client = await getClient(authUser.username);
            const list = await client.list(dir);
            newName = getAvailableName(newName, list);
            await client.rename(`${dir}/${entry.name}`, `${dir}/${newName}`);
            return { ...entry, name: newName };
        } catch (err) {
            ftpError("Error al renombrar", ftpRenameFailed);
        } finally {
            await closeClient(client);
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
    static async createUpload({ dir, entries, authUser }) {
        const id = randomUUID();
        const session = {
            type: "UPLOAD",
            dir,
            ownerId: authUser.id,
            username: authUser.username,
            entries: new Map(),
            createdDirs: new Set(),
            activeStreams: new Set()
        };
        let client;
        try {
            client = await getClient(authUser.username);
            await trackMissingDirectories(client, dir, session.createdDirs);
            await client.mkdir(dir, true);
            const list = await client.list(dir);
            const roots = new Map();
            const resolvedEntries = entries.map((entry) => {
                const [root, ...rest] = entry.path.split("/");
                if (!roots.has(root)) {
                    const name = getAvailableName(root, list);
                    roots.set(root, name);
                    list.push({ name });
                }

                return { ...entry, path: path.posix.join(roots.get(root), ...rest) };
            });
            for (const entry of resolvedEntries.filter((it) => it.type === dirType)) {
                const remoteDir = path.posix.join(dir, entry.path);
                await trackMissingDirectories(client, remoteDir, session.createdDirs);
                await client.mkdir(remoteDir, true);
            }

            const sessionEntries = resolvedEntries.map((entry) => {
                if (entry.type === dirType) {
                    return [entry.path, { ...entry, uploaded: true }];
                }

                return [entry.path, { ...entry, receivedBytes: 0, uploaded: false, uploading: false }];
            });
            const timeout = setTimeout(() => void expireTransfer(id), FtpService.#TRANSFER_SESSION_TIMEOUT);
            timeout.unref();
            session.timeout = timeout;
            session.entries = new Map(sessionEntries);
            transferSessions.set(id, session);
            return { id, entries: resolvedEntries };
        } catch (err) {
            await cleanupTransfer(session);
            ftpError("Error al preparar la subida", ftpUploadFailed);
        } finally {
            await closeClient(client);
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
    static async upload({ id, entryPath, offset = 0, file, authUser }) {
        handleApiErrors([
            { condition: !file, message: "Debe proporcionar un archivo", status: 400, apiError: ftpFileRequired }
        ]);
        const session = getTransferSession(id, "UPLOAD", authUser.id);
        const entry = session.entries.get(entryPath);
        handleApiErrors([{
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
        let client;
        let destination;
        entry.uploading = true;
        session.activeStreams.add(file.stream);
        try {
            client = await getClient(authUser.username);
            if (!entry.remotePath) {
                const remotePath = path.posix.join(session.dir, entryPath);
                const remoteDir = path.posix.dirname(remotePath);
                const name = getAvailableName(path.posix.basename(remotePath), await client.list(remoteDir));
                entry.remotePath = path.posix.join(remoteDir, name);
            }

            await client.mkdir(path.posix.dirname(entry.remotePath), true);
            destination = client.createWriteStream(entry.remotePath, {
                flags: offset === 0 ? "w" : "r+",
                start: offset
            });
            session.activeStreams.add(destination);
            const counter = createChunkCounter({ entry, offset, maxSize: FtpService.#MAX_UPLOAD_CHUNK_SIZE });
            await pipeline(file.stream, counter, destination);
            entry.receivedBytes = counter.size;
            entry.uploaded = entry.size === undefined || entry.receivedBytes === entry.size;
            return { nextOffset: entry.receivedBytes };
        } catch (err) {
            clearTimeout(session.timeout);
            transferSessions.delete(id);
            await cleanupTransfer(session);
            ftpError("Error al subir los datos", ftpUploadFailed);
        } finally {
            entry.uploading = false;
            session.activeStreams.delete(file.stream);
            session.activeStreams.delete(destination);
            await closeClient(client);
        }
    }

    /**
     * Completes an upload session
     *
     * @param {string} params.id Upload session identifier
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ dir: string }>} Uploaded FTP directory
     */
    static async completeUpload({ id, authUser }) {
        const session = getTransferSession(id, "UPLOAD", authUser.id);
        handleApiErrors([{
            condition: [...session.entries.values()].some((it) => !it.uploaded || it.uploading),
            message: "La subida contiene archivos pendientes",
            status: 409,
            apiError: ftpUploadFailed
        }]);
        clearTimeout(session.timeout);
        transferSessions.delete(id);
        return { dir: session.dir };
    }

    /**
     * Cancels a transfer session
     *
     * @param {string} params.id Transfer session identifier
     * @param {Object} params.authUser Authenticated user
     */
    static async cancelTransfer({ id, authUser }) {
        const session = getTransferSession(id, undefined, authUser.id);
        clearTimeout(session.timeout);
        transferSessions.delete(id);
        await cleanupTransfer(session);
    }

    /**
     * Creates a recursive download manifest
     *
     * @param {string} params.dir Source FTP directory
     * @param {{ name: string, type: string }[]} params.entries FTP entries
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<{ id: string, totalBytes: number, entries: { path: string, type: string, size?: number }[] }>} Download session
     */
    static async createDownload({ dir, entries, authUser }) {
        const id = randomUUID();
        let client;
        try {
            client = await getClient(authUser.username);
            const resolvedEntries = [];
            let totalBytes = 0;
            for await (const entry of createDownloadEntries(client, dir, entries)) {
                const resolvedEntry = entry.type === fileType
                    ? { path: entry.name, type: entry.type, size: entry.size }
                    : { path: entry.name, type: entry.type };
                totalBytes += entry.size ?? 0;
                handleApiErrors([{
                    condition: !Number.isSafeInteger(totalBytes),
                    message: "El tamaño total de la descarga supera el máximo permitido",
                    status: 400,
                    apiError: ftpDownloadFailed
                }]);
                resolvedEntries.push(resolvedEntry);
            }
            const timeout = setTimeout(() => void expireTransfer(id), FtpService.#TRANSFER_SESSION_TIMEOUT);
            timeout.unref();
            transferSessions.set(id, {
                type: "DOWNLOAD",
                dir,
                ownerId: authUser.id,
                username: authUser.username,
                timeout,
                entries: resolvedEntries,
                activeStreams: new Set()
            });
            return { id, totalBytes, entries: resolvedEntries };
        } catch (err) {
            ftpError("Error al preparar la descarga", ftpDownloadFailed);
        } finally {
            await closeClient(client);
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
    static async download({ id, entryPath, offset = 0, authUser, stream }) {
        const session = getTransferSession(id, "DOWNLOAD", authUser.id);
        const entry = session.entries.find((it) => it.path === entryPath && it.type === fileType);
        handleApiErrors([{
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
        let client;
        let source;
        try {
            client = await getClient(authUser.username);
            const remotePath = path.posix.join(session.dir, entryPath);
            let size;
            try {
                ({ size } = await client.stat(remotePath));
            } catch {
                throw createStaleDownloadError();
            }
            if (size !== entry.size) {
                throw createStaleDownloadError();
            }
            const remainingSize = entry.size - offset;
            stream.setHeader?.("Content-Length", remainingSize);
            if (!remainingSize) {
                stream.end();
                return;
            }

            source = client.createReadStream(remotePath, { start: offset });
            session.activeStreams.add(source);
            session.activeStreams.add(stream);
            await pipeline(source, createSizeValidator(remainingSize), stream);
        } catch (err) {
            clearTimeout(session.timeout);
            transferSessions.delete(id);
            await cleanupTransfer(session);
            if (err.code === ftpDownloadStale.code) {
                throw err;
            }

            ftpError("Error al descargar", ftpDownloadFailed);
        } finally {
            session.activeStreams.delete(source);
            session.activeStreams.delete(stream);
            await closeClient(client);
        }
    }

    /**
     * Deletes FTP resources
     *
     * @param {string} params.dir FTP directory path
     * @param {Object[]} params.entries Resources to delete
     * @param {{ username: string }} params.authUser Authenticated user
     * @param {(entry: Object) => Promise<void>} params.onEntry Handles each deleted resource
     */
    static async delete({ dir, entries, authUser, onEntry }) {
        let client;
        try {
            client = await getClient(authUser.username);
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
        } catch (err) {
            ftpError("Error al borrar", ftpDeleteFailed);
        } finally {
            await closeClient(client);
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
    static async #createThumbnail({ client, remotePath, size }) {
        if (!size) {
            return null;
        }

        const id = randomUUID();
        const timeout = setTimeout(() => FtpService.#mediaSessions.delete(id), FtpService.#MEDIA_SESSION_TIMEOUT);
        FtpService.#mediaSessions.set(id, {
            size,
            createReadStream: ({ start, end }) => client.createReadStream(remotePath, { start, end })
        });
        try {
            const response = await fetch(`${ENV.thumbnailGeneratorUrl}/thumbnail/${id}`, {
                method: "POST",
                headers: { Origin: ENV.apiUrl },
                signal: AbortSignal.timeout(FtpService.#MEDIA_SESSION_TIMEOUT)
            });
            if (!response.ok) {
                return null;
            }

            return FtpService.#readResponseBuffer(response, FtpService.#MAX_THUMBNAIL_SIZE);
        } finally {
            clearTimeout(timeout);
            FtpService.#mediaSessions.delete(id);
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
        handleApiErrors([{
            condition: contentLength > maxSize,
            message: "La miniatura supera el tamaño permitido",
            status: 413,
            apiError: ftpThumbnailTooLarge
        }]);

        const chunks = [];
        let size = 0;
        for await (const chunk of response.body) {
            size += chunk.length;
            handleApiErrors([{
                condition: size > maxSize,
                message: "La miniatura supera el tamaño permitido",
                status: 413,
                apiError: ftpThumbnailTooLarge
            }]);

            chunks.push(chunk);
        }

        return Buffer.concat(chunks, size);
    }
}

const { dir: dirType, file: fileType } = FILE_TYPE;
const { getClient, closeClient } = FtpClient;
const { handleApiErrors } = ValidateUtils;
const transferSessions = new Map();
const {
    ftpUploadFailed,
    ftpDownloadFailed,
    ftpDownloadStale,
    ftpDirFailed,
    ftpMkdirFailed,
    ftpMoveFailed,
    ftpRenameFailed,
    ftpDeleteFailed,
    ftpThumbnailTooLarge,
    ftpFileRequired
} = API_ERROR;

/**
 * Returns download entries preserving their relative paths
 *
 * @param {import("ssh2-sftp-client")} client SFTP client
 * @param {string} remoteDir Remote directory path
 * @param {Object[]} entries Directory entries
 * @param {string} [relativeDir] Relative download path
 * @returns {AsyncGenerator<{ name: string, type: string, remotePath: string, size?: number }>} Download entries
 */
async function* createDownloadEntries(client, remoteDir, entries, relativeDir = ".") {
    for (const entry of entries) {
        const name = path.posix.join(relativeDir, entry.name);
        const remotePath = path.posix.join(remoteDir, entry.name);
        const type = ["d", dirType].includes(entry.type) ? dirType : fileType;
        let size;
        if (type === fileType) {
            ({ size } = await client.stat(remotePath));
            handleApiErrors([{
                condition: !Number.isSafeInteger(size) || size < 0,
                message: "El tamaño del archivo no es válido",
                status: 400,
                apiError: ftpDownloadFailed
            }]);
        }
        yield { name, type, remotePath, ...(type === fileType && { size }) };
        if (type === dirType) {
            yield* createDownloadEntries(client, remotePath, await client.list(remotePath), name);
        }
    }
}

/**
 * Returns the requested byte range
 *
 * @param {string | undefined} source HTTP range header
 * @param {number} size Resource size in bytes
 * @returns {{ start: number, end: number, partial: boolean }} Byte range
 */
function getRange(source, size) {
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
 * Generates an available resource name
 *
 * @param {string} name Resource name
 * @param {{ name: string }[]} list Existing FTP resources
 * @returns {string} the generated unique resource name
 */
function getAvailableName(name, list) {
    if (!list.some((it) => it.name === name)) {
        return name;
    }

    const extension = path.posix.extname(name);
    const baseName = path.posix.basename(name, extension).replace(/ \(\d+\)$/, "");
    let copy = 1;
    while (list.some((it) => it.name === `${baseName} (${copy})${extension}`)) {
        copy += 1;
    }

    return `${baseName} (${copy})${extension}`;
}

function createChunkCounter({ entry, offset, maxSize }) {
    let chunkSize = 0;
    const counter = new Transform({
        transform(chunk, encoding, callback) {
            chunkSize += chunk.length;
            const receivedBytes = offset + chunkSize;
            if (maxSize > 0 && chunkSize > maxSize) {
                callback(new Error("El fragmento supera el tamaño permitido"));
                return;
            }

            if (entry.size !== undefined && receivedBytes > entry.size) {
                callback(new Error("El archivo supera el tamaño declarado"));
                return;
            }

            counter.size = receivedBytes;
            callback(null, chunk);
        }
    });
    counter.size = offset;
    return counter;
}

function createSizeValidator(expectedSize) {
    let size = 0;
    return new Transform({
        transform(chunk, encoding, callback) {
            size += chunk.length;
            callback(size > expectedSize ? createStaleDownloadError() : null, chunk);
        },
        flush(callback) {
            callback(size === expectedSize ? null : createStaleDownloadError());
        }
    });
}

function createStaleDownloadError() {
    return new ApiError({
        message: "El archivo ha cambiado desde que se creó la sesión",
        status: 409,
        apiError: ftpDownloadStale
    });
}

function getTransferSession(id, type, ownerId) {
    const session = transferSessions.get(id);
    handleApiErrors([{
        condition: !session || session.ownerId !== ownerId || (type && session.type !== type),
        message: "Sesión de transferencia no válida",
        status: 404,
        apiError: type === "DOWNLOAD" ? ftpDownloadFailed : ftpUploadFailed
    }]);
    return session;
}

async function expireTransfer(id) {
    const session = transferSessions.get(id);
    transferSessions.delete(id);
    await cleanupTransfer(session);
}

async function cleanupTransfer(session) {
    if (!session) {
        return;
    }

    for (const stream of session.activeStreams) {
        stream.destroy();
    }

    if (session.type !== "UPLOAD") {
        return;
    }

    let client;
    try {
        client = await getClient(session.username);
        for (const entry of session.entries.values()) {
            if (entry.type === fileType && entry.remotePath) {
                try {
                    await client.delete(entry.remotePath);
                } catch {
                    continue;
                }
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
    } catch {
        return;
    } finally {
        await closeClient(client);
    }
}

async function trackMissingDirectories(client, remoteDir, directories) {
    let currentDir = remoteDir;
    while (![".", "/"].includes(currentDir) && !(await client.exists(currentDir))) {
        directories.add(currentDir);
        currentDir = path.posix.dirname(currentDir);
    }
}

function ftpError(message, apiError) {
    handleApiErrors([{ condition: true, message, apiError }]);
}
