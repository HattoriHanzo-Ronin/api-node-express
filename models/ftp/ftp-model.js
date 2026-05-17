import ftp from "basic-ftp";
import fs from "fs/promises";
import AdmZip from "adm-zip";
import path from "path";

const createConnection = async () => {
    const client = new ftp.Client();

    await client.access({
        host: process.env.HOSTFTP,
        user: process.env.USERFTP,
        password: process.env.PASSFTP,
        secure: false
    });

    return client;
};
const close = async (client) => {
    if (client) await client.close();
};

/**
 * Renames the element if it already exists
 *
 */
const getFileName = async (name, list) => {
    try {
        const exist = list.some((it) => it.name === name);

        if (exist && !name.split(`_`).shift()?.includes("copia")) return await getFileName(`copia_${name}`, list);

        if (exist) {
            const newName = name.slice(name.indexOf("_") + 1, name.length),
                lastCopy = name.split("_").shift()?.replace("copia", "");
            return await getFileName(`copia${Number(lastCopy) + 1 || "1"}_${newName}`, list);
        }

        return name;
    } catch {
        return false;
    }
};

export class FtpModel {
    /**
     * Lists the content of a remote directory
     *
     * @param dir Path of the content to list if provided
     * @returns Returns the directory listing if everything goes well, otherwise false
     */
    static async dir({ dir }) {
        let client;
        try {
            client = await createConnection();

            if (dir) await client.cd(dir);

            return (await client.list()).map((it) => ({ name: it.name, type: it.isDirectory ? "dir" : "file" }));
        } catch {
            return false;
        } finally {
            await close(client);
        }
    }

    /**
     * Creates a new directory
     *
     * @param dir Path where the file is located
     * @param name Name of the directory to create
     * @returns Returns true if everything goes well, otherwise false
     */
    static async makeDir({ dir, name }) {
        let client;
        try {
            client = await createConnection();

            if (dir) await client.cd(dir);

            const list = await client.list();
            await client.ensureDir(await getFileName(name, list));
            return true;
        } catch {
            return false;
        } finally {
            await close(client);
        }
    }

    /**
     * Uploads files to the remote server, stores them in a temporary directory,
     * extracts them, and saves them in the corresponding path
     *
     * @param dir Path where the file is located
     * @param input Receives a zip file containing the content to upload
     * @returns Returns true if everything goes well, otherwise false
     */
    static async upload({ dir, input }) {
        const tempDir = `${process.cwd()}/temp${Date.now()}`;
        let client;
        try {
            const zip = new AdmZip(input.buffer);
            client = await createConnection();
            zip.extractAllTo(tempDir, true);

            if (dir) await client.cd(dir);

            const list = await client.list();
            for (const item of await fs.readdir(tempDir, { withFileTypes: true })) {
                const newName = await getFileName(item.name, list);
                list.push({ name: newName });

                if (item.isDirectory()) {
                    const pathDir = path.join(tempDir, item.name);
                    await client.ensureDir(newName);

                    if ((await fs.readdir(pathDir)).length > 0) {
                        await client.uploadFromDir(pathDir);
                        await client.cd("..");
                    }
                } else {
                    const pathFile = path.join(tempDir, item.name);
                    await client.uploadFrom(pathFile, newName);
                }
            }

            return true;
        } catch {
            return false;
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
            await close(client);
        }
    }

    /**
     * Prepares the content to download, stores it in a temporary directory,
     * and compresses it
     *
     * @param dir Path where the content is located
     * @param input Receives a JSON object with the structure to download
     * @returns Returns the compressed file path if everything goes well, otherwise false
     */
    static async download({ dir, input }) {
        const tempDir = `${process.cwd()}/temp${Date.now()}`;
        const tempToZip = `${tempDir}/toZip`;
        const zipFile = `${tempDir}/${Date.now()}.zip`;
        let client;
        try {
            const zip = new AdmZip();
            await fs.mkdir(tempToZip, { recursive: true });
            client = await createConnection();

            if (dir) await client.cd(dir);

            for (const item of input) {
                if (item.type === "dir") {
                    const newDir = `${tempToZip}/${item.path}`;
                    await fs.mkdir(newDir);
                    await client.downloadToDir(newDir, item.path);
                } else await client.downloadTo(`${tempToZip}/${item.path}`, item.path);
            }

            zip.addLocalFolder(tempToZip);
            await zip.writeZipPromise(zipFile);
            return { url: zipFile };
        } catch {
            return false;
        } finally {
            setTimeout(async () => {
                await fs.rm(tempDir, { recursive: true, force: true });
            }, 60000);
            await close(client);
        }
    }

    /**
     * Downloads a single file
     *
     * @param dir Path where the file is located
     * @param file File name
     * @returns Returns the file path if everything goes well, otherwise false
     */
    static async getFile({ dir, file }) {
        const tempDir = `${process.cwd()}/temp${Date.now()}`;
        const newFile = `${tempDir}/${file}`;
        let client;
        try {
            client = await createConnection();
            await fs.mkdir(tempDir);

            if (dir) await client.cd(dir);

            await client.downloadTo(newFile, file);
            return newFile;
        } catch {
            return false;
        } finally {
            setTimeout(async () => {
                await fs.rm(tempDir, { recursive: true, force: true });
            }, 60000);
            await close(client);
        }
    }

    /**
     * Deletes a file or directory
     *
     * @param path Path of the file or directory
     * @param type Indicates whether it is a file or a directory
     * @returns Returns the compressed file path if everything goes well, otherwise false
     */
    static async delete({ path, type }) {
        let client;
        try {
            client = await createConnection();

            if (!path) return false;

            if (type === "dir") await client.removeDir(path);
            else await client.remove(path);

            return true;
        } catch {
            return false;
        } finally {
            await close(client);
        }
    }
}
