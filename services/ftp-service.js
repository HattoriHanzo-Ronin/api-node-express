import fs from "fs/promises";
import AdmZip from "adm-zip";
import path from "path";
import { Readable } from "stream";
import ValidateUtils from "../utils/validate-utils.js";
import FtpConnection from "../config/ftp-connection.js";

/**
 *  FTP service
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpService {
    /**
     * Lists the content of a remote FTP directory
     *
     * @param {string | null} params.dir FTP directory path
     * @returns {Promise<Array<{ name: string, type: "FILE" | "DIR" }>>} List of directory resources
     */
    static async dir({ dir }) {
        let client;
        try {
            client = await getClient();
            if (dir) {
                await client.cd(dir);
            }

            const list = await client.list();
            return list.map((it) => ({ name: it.name, type: it.isDirectory ? "DIR" : "FILE" }));
        } catch (err) {
            ftpError("Error al listar la carpeta", "FTP_DIR_FAILED");
        } finally {
            closeClient(client);
        }
    }

    /**
     * Creates a directory in the current FTP location
     *
     * @param {string | null} params.dir FTP directory path
     * @param {string} params.name Directory name
     */
    static async makeDir({ dir, name }) {
        let client;
        try {
            client = await getClient();
            if (dir) {
                await client.cd(dir);
            }

            const list = await client.list();
            await client.ensureDir(await getFileName(name, list));
        } catch (err) {
            ftpError("Error al crear la carpeta", "FTP_MKDIR_FAILED");
        } finally {
            closeClient(client);
        }
    }

    /**
     * Uploads a file or ZIP archive to the FTP server
     *
     * @param {string | null} params.dir FTP directory path
     * @param {{ originalname: string, mimetype: string, buffer: Buffer }} params.file Uploaded file
     */
    static async upload({ dir, file }) {
        handleApiErrors([
            { condition: !file, message: "Debe proporcionar un archivo", status: 400, code: "FTP_FILE_REQUIRED" }
        ]);
        const { originalname, mimetype, buffer } = file;
        let client;
        let newName;
        let tempDir;
        try {
            client = await getClient();
            if (dir) {
                await client.cd(dir);
            }

            const isZip = mimetype === "application/zip" || originalname.toLowerCase().endsWith(".zip");
            const list = await client.list();
            if (!isZip) {
                newName = await getFileName(originalname, list);
                await client.uploadFrom(Readable.from(buffer), newName);
                return;
            }

            tempDir = `${process.cwd()}/temp${Date.now()}`;
            const zip = new AdmZip(buffer);
            zip.extractAllTo(tempDir, true);
            for (const item of await fs.readdir(tempDir, { withFileTypes: true })) {
                const { name, isDirectory } = item;
                newName = await getFileName(name, list);
                list.push({ name: newName });
                if (isDirectory()) {
                    const pathDir = path.join(tempDir, name);
                    await client.ensureDir(newName);
                    if ((await fs.readdir(pathDir)).length > 0) {
                        await client.uploadFromDir(pathDir);
                        await client.cd("..");
                    }
                } else {
                    const pathFile = path.join(tempDir, name);
                    await client.uploadFrom(pathFile, newName);
                }
            }
        } catch (err) {
            ftpError("Error al subir los datos", "FTP_UPLOAD_FAILED");
        } finally {
            closeClient(client);
            if (tempDir) {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        }
    }

    /**
     * Downloads FTP resources
     *
     * @param {string | null} params.dir FTP directory path
     * @param {{ name: string, type: "FILE" | "DIR" }[]} params.paths Resources to download
     * @returns {Promise<string>} the generated local file path
     */
    static async download({ dir, paths }) {
        const isSingleFile = paths.length === 1 && paths[0].type === "FILE";
        const tempDir = `${process.cwd()}/temp${Date.now()}`;
        let client;
        let name;
        try {
            client = await getClient();
            await fs.mkdir(tempDir);
            if (dir) {
                await client.cd(dir);
            }

            if (isSingleFile) {
                name = paths[0].name;
                const newFile = `${tempDir}/${name}`;
                await client.downloadTo(newFile, name);
                return newFile;
            }

            const zip = new AdmZip();
            const tempToZip = `${tempDir}/toZip`;
            const zipFile = `${tempDir}/${Date.now()}.zip`;
            await fs.mkdir(tempToZip, { recursive: true });
            for (const it of paths) {
                let name = it.name;
                if (it.type === "DIR") {
                    const newDir = `${tempToZip}/${name}`;
                    await fs.mkdir(newDir);
                    await client.downloadToDir(newDir, name);
                } else {
                    await client.downloadTo(`${tempToZip}/${name}`, name);
                }
            }
            zip.addLocalFolder(tempToZip);
            await zip.writeZipPromise(zipFile);
            return zipFile;
        } catch (err) {
            ftpError("Error al descargar", "FTP_DOWNLOAD_FAILED");
        } finally {
            closeClient(client);
            setTimeout(async () => {
                await fs.rm(tempDir, { recursive: true, force: true });
            }, 60000);
        }
    }

    /**
     * Deletes a file or directory from the FTP server
     *
     * @param {string} params.path Resource path
     * @param {"FILE" | "DIR"} params.type Resource type
     */
    static async delete({ path, type }) {
        let client;
        try {
            client = await getClient();
            if (type === "DIR") {
                await client.removeDir(path);
            } else {
                await client.remove(path);
            }
        } catch (err) {
            ftpError("Error al borrar", "FTP_DELETE_FAILED");
        } finally {
            closeClient(client);
        }
    }
}

const { getClient, closeClient } = FtpConnection;
const { handleApiErrors } = ValidateUtils;

/**
 * Generates an available resource name
 *
 * @param {string} name Resource name
 * @param {import("basic-ftp").FileInfo[]} list Existing FTP resources
 * @returns {Promise<string>} the generated unique resource name
 */
async function getFileName(name, list) {
    const exist = list.some((it) => it.name === name);
    if (exist && !name.split(`_`).shift()?.includes("copia")) {
        return await getFileName(`copia_${name}`, list);
    }

    if (exist) {
        const newName = name.slice(name.indexOf("_") + 1, name.length);
        const lastCopy = name.split("_").shift()?.replace("copia", "");
        return await getFileName(`copia${Number(lastCopy) + 1 || "1"}_${newName}`, list);
    }

    return name;
}

function ftpError(message, code) {
    handleApiErrors([{ condition: true, message, code }]);
}
