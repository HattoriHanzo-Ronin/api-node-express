import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { finished } from "node:stream/promises";
import ffmpegPath from "ffmpeg-static";
import path from "path";
import ValidateUtils from "../utils/validate-utils.js";
import CompressionUtils from "../utils/compression-utils.js";
import FtpConnection from "../config/ftp-connection.js";
import { API_ERROR, FILE_TYPE } from "../config/constants.js";

/**
 * FTP service
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpService {
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
            return list.map(({ name, type, size, modifyTime }) => ({
                name,
                type: type === "d" ? dirType : fileType,
                size,
                modifyTime
            }));
        } catch (err) {
            ftpError("Error al listar la carpeta", ftpDirFailed);
        } finally {
            await closeClient(client);
        }
    }

    /**
     * Returns image and video thumbnails from a FTP directory
     *
     * @param {string} params.dir FTP directory path
     * @param {string[]} params.names File names
     * @param {Object} params.authUser Authenticated user
     * @returns {Promise<Map<string, Buffer | null>>} JPEG thumbnails by file name, or null when processing fails
     */
    static async getThumbails({ dir, names, authUser }) {
        const thumbnails = new Map();
        if (!names.length) {
            return thumbnails;
        }

        let client;
        try {
            client = await getClient(authUser.username);
            for (const name of names) {
                if (!MEDIA_EXTENSION.test(path.extname(name))) {
                    thumbnails.set(name, null);
                    continue;
                }

                try {
                    const buffer = await client.get(path.posix.join(dir, name));
                    thumbnails.set(name, await createThumbnail(buffer));
                } catch (err) {
                    thumbnails.set(name, null);
                }
            }
            return thumbnails;
        } finally {
            await closeClient(client);
        }
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
}

const executeFile = promisify(execFile);
const MEDIA_EXTENSION = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic|heif|mp4|m4v|mov|mkv|webm|avi|mpeg|mpg|wmv|flv|3gp|mts|m2ts|ogv)$/i;
const { dir: dirType, file: fileType } = FILE_TYPE;
const { getClient, closeClient } = FtpConnection;
const { handleApiErrors } = ValidateUtils;
const {
    ftpUploadFailed,
    ftpDownloadFailed,
    ftpDirFailed,
    ftpMkdirFailed,
    ftpMoveFailed,
    ftpRenameFailed,
    ftpDeleteFailed,
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
 * Creates a JPEG thumbnail using seekable access to an in-memory media buffer
 *
 * @param {Buffer} buffer Media content
 * @returns {Promise<Buffer | null>} JPEG thumbnail
 */
async function createThumbnail(buffer) {
    if (!buffer.length) {
        return null;
    }

    const server = createServer((request, response) => {
        const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
        const start = range ? Number(range[1]) : 0;
        const end = range?.[2] ? Math.min(Number(range[2]), buffer.length - 1) : buffer.length - 1;
        if (start > end || start >= buffer.length) {
            response.writeHead(416, { "Content-Range": `bytes */${buffer.length}` });
            response.end();
            return;
        }

        const headers = { "Accept-Ranges": "bytes", "Content-Length": end - start + 1 };
        if (range) {
            headers["Content-Range"] = `bytes ${start}-${end}/${buffer.length}`;
        }

        response.writeHead(range ? 206 : 200, headers);
        response.end(buffer.subarray(start, end + 1));
    });
    try {
        await new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(0, "127.0.0.1", resolve);
        });
        const { stdout } = await executeFile(ffmpegPath, [
            "-nostdin", "-loglevel", "error", "-http_proxy", "",
            "-i", `http://127.0.0.1:${server.address().port}/media`,
            "-map", "0:v:0", "-frames:v", "1",
            "-vf", "scale=320:320:force_original_aspect_ratio=decrease",
            "-c:v", "mjpeg", "-f", "image2pipe", "pipe:1"
        ], { encoding: "buffer", timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
        return stdout.length ? stdout : null;
    } finally {
        await new Promise((resolve) => {
            server.close(resolve);
            server.closeAllConnections();
        });
    }
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
