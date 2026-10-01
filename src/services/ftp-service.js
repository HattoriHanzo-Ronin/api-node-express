import { randomUUID } from "node:crypto";
import { finished, pipeline } from "node:stream/promises";
import path from "path";
import ValidateUtils from "../utils/validate-utils.js";
import CompressionUtils from "../utils/compression-utils.js";
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
    static #MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024;
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
                    supportsThumbnail: normalizedType === fileType && MEDIA_EXTENSION.test(path.extname(name))
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
            const newName = getFileName(name, list);
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
     * @returns {Promise<{ lastContent: string[], movedContent: Object[] }>} Moved resources
     */
    static async move({ dir, entries, destination, authUser }) {
        let client;
        try {
            client = await getClient(authUser.username);
            const list = await client.list(destination);
            const movedContent = [];
            for (const item of entries) {
                const newName = getFileName(item.name, list);
                await client.rename(`${dir}/${item.name}`, `${destination}/${newName}`);
                list.push({ name: newName });
                movedContent.push({ ...item, name: newName });
            }
            return { lastContent: entries.map(({ name }) => name), movedContent };
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
            newName = getFileName(newName, list);
            await client.rename(`${dir}/${entry.name}`, `${dir}/${newName}`);
            return { ...entry, name: newName };
        } catch (err) {
            ftpError("Error al renombrar", ftpRenameFailed);
        } finally {
            await closeClient(client);
        }
    }

    /**
     * Creates FTP resources from an uploaded file
     *
     * @param {string} params.dir FTP directory path
     * @param {boolean} params.extract Extract ZIP content
     * @param {{ originalname: string, mimetype: string, stream: import("node:stream").Readable }} params.file Uploaded file
     * @param {{ username: string }} params.authUser Authenticated user
     */
    static async upload({ dir, extract, file, authUser }) {
        handleApiErrors([
            { condition: !file, message: "Debe proporcionar un archivo", status: 400, apiError: ftpFileRequired }
        ]);
        const { originalname, stream } = file;
        let client;
        try {
            client = await getClient(authUser.username);
            if (!extract) {
                const fileName = getFileName(originalname, await client.list(dir));
                await client.put(stream, path.posix.join(dir, fileName));
                return;
            }

            const directories = new Map([[".", "."]]);
            const list = await client.list(dir);
            await CompressionUtils.executeUpload({
                stream,
                callback: (entry) => uploadZipEntry({ client, dir, entry, directories, list })
            });
        } catch (err) {
            if (err.code === zipInvalidPath.code) {
                throw err;
            }

            ftpError("Error al subir los datos", ftpUploadFailed);
        } finally {
            await closeClient(client);
        }
    }

    /**
     * Downloads FTP resources
     *
     * @param {string} params.dir FTP directory path
     * @param {Object[]} params.entries Resources to download
     * @param {{ username: string }} params.authUser Authenticated user
     * @param {import("node:stream").Writable} params.stream Download destination
     */
    static async download({ dir, entries, authUser, stream }) {
        const isSingleFile = entries.length === 1 && entries[0].type === fileType;
        let client;
        try {
            client = await getClient(authUser.username);
            if (isSingleFile) {
                await client.get(path.posix.join(dir, entries[0].name), stream);
                await finished(stream, { readable: false });
                return;
            }

            await CompressionUtils.executeDownload({
                entries: createDownloadEntries(client, dir, entries),
                stream,
                callback: ({ remotePath }, destination) => client.get(remotePath, destination)
            });
        } catch (err) {
            ftpError("Error al descargar", ftpDownloadFailed);
        } finally {
            await closeClient(client);
        }
    }

    /**
     * Deletes FTP resources
     *
     * @param {string} params.dir FTP directory path
     * @param {Object[]} params.entries Resources to delete
     * @param {{ username: string }} params.authUser Authenticated user
     */
    static async delete({ dir, entries, authUser }) {
        let client;
        try {
            client = await getClient(authUser.username);
            for (const { name, type } of entries) {
                const remotePath = `${dir}/${name}`;
                if (type === dirType) {
                    await client.rmdir(remotePath, true);
                } else {
                    await client.delete(remotePath);
                }
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

const MEDIA_EXTENSION = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic|heif|mp4|m4v|mov|mkv|webm|avi|mpeg|mpg|wmv|flv|3gp|mts|m2ts|ogv)$/i;
const { dir: dirType, file: fileType } = FILE_TYPE;
const { getClient, closeClient } = FtpClient;
const { handleApiErrors } = ValidateUtils;
const {
    ftpUploadFailed,
    ftpDownloadFailed,
    ftpDirFailed,
    ftpMkdirFailed,
    ftpMoveFailed,
    ftpRenameFailed,
    ftpDeleteFailed,
    ftpThumbnailTooLarge,
    ftpFileRequired,
    zipInvalidPath
} = API_ERROR;

/**
 * Returns download entries preserving their relative paths
 *
 * @param {import("ssh2-sftp-client")} client SFTP client
 * @param {string} remoteDir Remote directory path
 * @param {Object[]} entries Directory entries
 * @param {string} [relativeDir] Relative download path
 * @returns {AsyncGenerator<{ name: string, type: string, remotePath: string }>} Download entries
 */
async function* createDownloadEntries(client, remoteDir, entries, relativeDir = ".") {
    for (const entry of entries) {
        const name = path.posix.join(relativeDir, entry.name);
        const remotePath = path.posix.join(remoteDir, entry.name);
        const type = ["d", dirType].includes(entry.type) ? dirType : fileType;
        yield { name, type, remotePath };
        if (type === dirType) {
            yield* createDownloadEntries(client, remotePath, await client.list(remotePath), name);
        }
    }
}

/**
 * Uploads a ZIP entry preserving its directory structure
 *
 * @param {import("ssh2-sftp-client")} params.client SFTP client
 * @param {string} params.dir Destination directory
 * @param {{ name: string, isDirectory: boolean, stream?: import("node:stream").Readable }} params.entry ZIP entry
 * @param {Map<string, string>} params.directories Resolved directory paths
 * @param {{ name: string }[]} params.list Destination directory content
 */
async function uploadZipEntry({ client, dir, entry, directories, list }) {
    const sourceDir = path.posix.dirname(entry.name);
    const destinationDir = directories.get(sourceDir);
    const remoteDir = destinationDir === "." ? dir : path.posix.join(dir, destinationDir);
    const isRoot = sourceDir === ".";
    const sourceName = path.posix.basename(entry.name);
    const name = isRoot ? getFileName(sourceName, list) : sourceName;
    const remotePath = path.posix.join(remoteDir, name);
    if (entry.isDirectory) {
        await client.mkdir(remotePath);
        directories.set(entry.name, path.posix.join(destinationDir, name));
    } else {
        await client.put(entry.stream, remotePath);
    }

    if (isRoot) {
        list.push({ name });
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
function getFileName(name, list) {
    const exist = list.some((it) => it.name === name);
    if (exist && !name.split(`_`).shift()?.includes("copia")) {
        return getFileName(`copia_${name}`, list);
    }

    if (exist) {
        const newName = name.slice(name.indexOf("_") + 1, name.length);
        const lastCopy = name.split("_").shift()?.replace("copia", "");
        return getFileName(`copia${Number(lastCopy) + 1 || "1"}_${newName}`, list);
    }

    return name;
}

function ftpError(message, apiError) {
    handleApiErrors([{ condition: true, message, apiError }]);
}
