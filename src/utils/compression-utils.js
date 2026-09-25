import path from "node:path";
import { PassThrough } from "node:stream";
import { finished } from "node:stream/promises";
import { ZipArchive } from "archiver";
import unzipper from "unzipper";
import { API_ERROR, FILE_TYPE } from "../config/constants.js";
import ValidateUtils from "./validate-utils.js";

/**
 * ZIP file compression and extraction utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class CompressionUtils {
    /**
     * Extracts and processes a ZIP stream
     *
     * @param {import("node:stream").Readable} params.stream ZIP stream
     * @param {(source: { name: string, isDirectory: boolean, stream?: import("node:stream").Readable }) => Promise<void>} params.callback Entry processor
     */
    static async executeUpload({ stream, callback }) {
        const directories = new Set();
        const parser = stream.pipe(unzipper.Parse({ forceStream: true }));
        try {
            for await (const entry of parser) {
                const { name, parentDirectories } = getEntryPath(entry.path);
                for (const directory of parentDirectories) {
                    if (directories.has(directory)) {
                        continue;
                    }

                    directories.add(directory);
                    await callback({ name: directory, isDirectory: true });
                }

                if (entry.type === "Directory") {
                    entry.autodrain();
                    if (!directories.has(name)) {
                        directories.add(name);
                        await callback({ name, isDirectory: true });
                    }
                    continue;
                }

                await callback({ name, isDirectory: false, stream: entry });
            }
        } catch (error) {
            parser.destroy(error);
            throw error;
        }
    }

    /**
     * Creates a ZIP stream from download entries
     *
     * @param {Iterable<{ name: string, type: string }> | AsyncIterable<{ name: string, type: string }>} params.entries Download entries
     * @param {import("node:stream").Writable} params.stream ZIP destination stream
     * @param {(entry: { name: string, type: string }, destination: import("node:stream").Writable) => Promise<void>} params.callback File downloader
     */
    static async executeDownload({ entries, stream, callback }) {
        const archive = new ZipArchive();
        const completed = finished(stream);
        archive.pipe(stream);
        archive.once("error", (error) => stream.destroy(error));
        archive.once("warning", (error) => stream.destroy(error));
        try {
            for await (const entry of entries) {
                const { name, type } = entry;
                if (type === dirType) {
                    archive.append(Buffer.alloc(0), { name: name + "/" });
                    continue;
                }

                const source = new PassThrough();
                archive.append(source, { name });
                await callback(entry, source);
            }
            await archive.finalize();
            await completed;
        } catch (error) {
            archive.abort();
            stream.destroy(error);
            await completed.catch(() => undefined);
            throw error;
        }
    }
}

const { zipInvalidPath } = API_ERROR;
const { dir: dirType } = FILE_TYPE;
const { handleApiErrors } = ValidateUtils;

function getEntryPath(source) {
    const entryPath = path.posix.normalize(source.replaceAll("\\", "/"));
    handleApiErrors([
        {
            condition: path.posix.isAbsolute(entryPath) || entryPath === ".." || entryPath.startsWith("../"),
            message: "El ZIP contiene una ruta no válida",
            status: 400,
            apiError: zipInvalidPath
        }
    ]);

    const pathParts = entryPath.split("/").filter(Boolean);
    const name = pathParts.join("/");
    const parentDirectories = pathParts.slice(0, -1).map((_, index) => pathParts.slice(0, index + 1).join("/"));
    return { name, parentDirectories };
}
