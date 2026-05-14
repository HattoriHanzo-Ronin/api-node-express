import ftp from "basic-ftp"
import fs from "fs/promises"
import AdmZip from "adm-zip"
import path from "path"

const createConnection = async () => {
    const client = new ftp.Client();

    await client.access({
        host: process.env.HOSTFTP,
        user: process.env.USERFTP,
        password: process.env.PASSFTP,
        secure: false
    })

    return client
},
    close = async (client) => {

        if (client) await client.close()

    },

    // cambia el nombre si el elemento ya existe
    getFileName = async (name, list) => {
        try {
            const exist = list.some(it => it.name === name)

            if (exist && !name.split(`_`).shift()?.includes("copia")) return await getFileName(`copia_${name}`, list)

            if (exist) {
                const newName = name.slice(name.indexOf("_") + 1, name.length), lastCopy = name.split("_").shift()?.replace("copia", "")
                return await getFileName(`copia${Number(lastCopy) + 1 || "1"}_${newName}`, list)
            }

            return name
        } catch {
            return false
        }
    }

export class FtpModel {

    /**
     * Listará el contenido de una carpeta en remoto
     * 
     * @param dir Ruta del cotnenido a listar si se le pasa
     * @returns Devolverá el listado de la carpeta si todo sale bien sino false
     */
    static async dir({ dir }) {
        let client;
        try {
            client = await createConnection()

            if (dir) await client.cd(dir)

            return (await client.list()).map(it => ({ name: it.name, type: it.isDirectory ? "dir" : "file" }))
        } catch {
            return false
        } finally {
            await close(client)
        }
    }

    /**
     * Se encargará de crear un nuevo directorio
     * 
     * @param dir Recibe la ruta donde se encuentra el archivo
     * @param name Nombre de la carpeta que se quiere crear
     * @returns Devolverá true si todo sale bien y false si algo falla
     */
    static async makeDir({ dir, name }) {
        let client;
        try {
            client = await createConnection()

            if (dir) await client.cd(dir)

            const list = await client.list()
            await client.ensureDir(await getFileName((name), list))
            return true
        } catch {
            return false
        } finally {
            await close(client)
        }
    }

    /**
     * Se encargará de subir archivos al remoto, guardará en directorio temporal, descomprimirá y almacenará en la ruta correspondiente
     * 
     * @param dir Recibe la ruta donde se encuentra el archivo
     * @param input Recibe un archivo zip con el contenido que se quiere subir
     * @returns Devolverá true si todo sale bien y false si algo falla
     */
    static async upload({ dir, input }) {
        const tempDir = `${process.cwd()}/temp${Date.now()}`
        let client
        try {
            const zip = new AdmZip(input.buffer)
            client = await createConnection()
            zip.extractAllTo(tempDir, true)

            if (dir) await client.cd(dir)

            const list = await client.list()
            for (const item of await fs.readdir(tempDir, { withFileTypes: true })) {
                const newName = await getFileName(item.name, list)
                list.push({ name: newName })

                if (item.isDirectory()) {
                    const pathDir = path.join(tempDir, item.name)
                    await client.ensureDir(newName)

                    if ((await fs.readdir(pathDir)).length > 0) {
                        await client.uploadFromDir(pathDir)
                        await client.cd("..")
                    }
                } else {
                    const pathFile = path.join(tempDir, item.name)
                    await client.uploadFrom(pathFile, newName)
                }

            }

            return true
        } catch {
            return false
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true })
            await close(client)
        }
    }

    /**
     * Dispondrá el contenido que se quiere descargar, guardará en directorio temporal y comprimirá
     * 
     * @param dir Recibe la ruta donde se encuentra el contenido
     * @param input Recibe un objeto json con la estructura que se quiere descargar
     * @returns Devolverá la ruta del archivo comprimido si todo sale bien y false si algo falla
     */
    static async download({ dir, input }) {
        const tempDir = `${process.cwd()}/temp${Date.now()}`, tempToZip = `${tempDir}/toZip`, zipFile = `${tempDir}/${Date.now()}.zip`
        let client
        try {
            const zip = new AdmZip()
            await fs.mkdir(tempToZip, { recursive: true })
            client = await createConnection()

            if (dir) await client.cd(dir)

            for (const item of input) {

                if (item.type === "dir") {
                    const newDir = `${tempToZip}/${item.path}`
                    await fs.mkdir(newDir)
                    await client.downloadToDir(newDir, item.path)
                } else await client.downloadTo(`${tempToZip}/${item.path}`, item.path)

            }

            zip.addLocalFolder(tempToZip)
            await zip.writeZipPromise(zipFile)
            return { url: zipFile }
        } catch {
            return false
        } finally {
            setTimeout(async () => {
                await fs.rm(tempDir, { recursive: true, force: true })
            }, 60000)
            await close(client)
        }
    }

    /**
     * Si se quiere descargar un solo archivo
     * 
     * @param dir Recibe la ruta donde se encuentra el archivo
     * @param file El nombre del archivo
     * @returns Devolverá la ruta del archivo si todo sale bien y false si algo falla
     */
    static async getFile({ dir, file }) {
        const tempDir = `${process.cwd()}/temp${Date.now()}`, newFile = `${tempDir}/${file}`
        let client
        try {
            client = await createConnection()
            await fs.mkdir(tempDir)

            if (dir) await client.cd(dir)

            await client.downloadTo(newFile, file)
            return newFile
        } catch {
            return false
        } finally {
            setTimeout(async () => {
                await fs.rm(tempDir, { recursive: true, force: true })
            }, 60000)
            await close(client)
        }
    }

    /**
     * Borrará un archivo o directorio que se le pasa
     * 
     * @param path Ruta del archivo o directorio
     * @param type Si es un archivo o un directorio
     * @returns Devolverá la ruta del archivo comprimido si todo sale bien y false si algo falla
     */
    static async delete({ path, type }) {
        let client
        try {
            client = await createConnection()

            if (!path) return false

            if (type === "dir") await client.removeDir(path)
            else await client.remove(path)

            return true
        } catch {
            return false
        } finally {
            await close(client)
        }
    }
}