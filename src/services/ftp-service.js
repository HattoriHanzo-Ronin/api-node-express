import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import ffmpegPath from "ffmpeg-static";
import fs from "fs/promises";
import AdmZip from "adm-zip";
import path from "path";
import ValidateUtils from "../utils/validate-utils.js";
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
            return list.map(({ name, type, size, modifiedAt }) => ({
                name,
                type: type === "d" ? dirType : fileType,
                size,
                modifiedAt
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
     * @returns {Promise<Object>} Created directory
     */
    static async makeDir({ dir, name, authUser }) {
        let client;
        try {
            client = await getClient(authUser.username);
            const list = await client.list(dir);
            const newName = getFileName(name, list);
            await client.mkdir(`${dir}/${newName}`);
            return { name: newName, type: dirType };
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
     * @param {{ originalname: string, mimetype: string, buffer: Buffer }} params.file Uploaded file
     * @param {{ username: string }} params.authUser Authenticated user
     * @returns {Promise<Object[]>} Uploaded resources
     */
    static async upload({ dir, file, authUser }) {
        handleApiErrors([
            { condition: !file, message: "Debe proporcionar un archivo", status: 400, apiError: ftpFileRequired }
        ]);
        const { originalname, mimetype, buffer } = file;
        let client;
        let tempDir;
        try {
            client = await getClient(authUser.username);
            const isZip = mimetype === "application/zip" || originalname.toLowerCase().endsWith(".zip");
            if (!isZip) {
                const fileName = `${getFileName(originalname, await client.list(dir))}`;
                await client.put(buffer, `${dir}/${fileName}`);
                return [{ name: fileName, type: fileType }];
            }

            tempDir = `${process.cwd()}/temp${Date.now()}`;
            const zip = new AdmZip(buffer);
            zip.extractAllTo(tempDir, true);
            const addedContent = [];
            const uploadTempDir = async ({ remoteDir, localDir }) => {
                const list = await client.list(remoteDir);
                for (const { name, isDirectory } of await fs.readdir(localDir, { withFileTypes: true })) {
                    const newName = getFileName(name, list);
                    const remotePath = `${remoteDir}/${newName}`;
                    const localPath = path.join(localDir, name);
                    if (isDirectory()) {
                        await client.mkdir(remotePath);
                        if ((await fs.readdir(localPath)).length > 0) {
                            await uploadTempDir({ remoteDir: remotePath, localDir: localPath });
                        }
                    } else {
                        await client.fastPut(localPath, remotePath);
                    }

                    list.push({ name: newName });
                    if (localDir === tempDir) {
                        addedContent.push({ name: newName, type: isDirectory() ? dirType : fileType });
                    }
                }
            };
            await uploadTempDir({ remoteDir: dir, localDir: tempDir });
            return addedContent;
        } catch (err) {
            ftpError("Error al subir los datos", ftpUploadFailed);
        } finally {
            await closeClient(client);
            if (tempDir) {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        }
    }

    /**
     * Downloads FTP resources
     *
     * @param {string} params.dir FTP directory path
     * @param {Object[]} params.entries Resources to download
     * @param {{ username: string }} params.authUser Authenticated user
     * @returns {Promise<string>} the generated local file path
     */
    static async download({ dir, entries, authUser }) {
        const isSingleFile = entries.length === 1 && entries[0].type === fileType;
        const tempDir = `${process.cwd()}/temp${Date.now()}`;
        let client;
        try {
            client = await getClient(authUser.username);
            await fs.mkdir(tempDir);
            if (isSingleFile) {
                const { name } = entries[0];
                const newFile = `${tempDir}/${name}`;
                await client.fastGet(`${dir}/${name}`, newFile);
                return newFile;
            }

            const tempToZip = `${tempDir}/toZip`;
            const zipFile = `${tempDir}/${Date.now()}.zip`;
            await fs.mkdir(tempToZip);
            const downloadRemoteDir = async ({ remoteDir, remoteList, localDir }) => {
                for (const { name, type } of remoteList) {
                    const localPath = path.join(localDir, name);
                    const remotePath = `${remoteDir}/${name}`;
                    if (["d", dirType].includes(type)) {
                        await fs.mkdir(localPath);
                        await downloadRemoteDir({
                            remoteDir: remotePath,
                            remoteList: await client.list(remotePath),
                            localDir: localPath
                        });
                    } else {
                        await client.fastGet(remotePath, localPath);
                    }
                }
            };
            await downloadRemoteDir({ remoteDir: dir, remoteList: entries, localDir: tempToZip });
            const zip = new AdmZip();
            zip.addLocalFolder(tempToZip);
            await zip.writeZipPromise(zipFile);
            return zipFile;
        } catch (err) {
            ftpError("Error al descargar", ftpDownloadFailed);
        } finally {
            await closeClient(client);
            setTimeout(async () => {
                await fs.rm(tempDir, { recursive: true, force: true });
            }, 60000);
        }
    }

    /**
     * Deletes FTP resources
     *
     * @param {string} params.dir FTP directory path
     * @param {Object[]} params.entries Resources to delete
     * @param {{ username: string }} params.authUser Authenticated user
     * @returns {Promise<string[]>} Deleted resource names
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
            return entries.map(({ name }) => name);
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
    ftpFileRequired
} = API_ERROR;

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
