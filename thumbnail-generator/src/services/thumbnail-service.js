import { spawn } from "node:child_process";
import { resolve4 } from "node:dns/promises";
import { isIP } from "node:net";
import ffmpegPath from "ffmpeg-static";
import { ENV } from "../config/environment.js";

/**
 * Streamed media thumbnail generator
 *
 * @author HattoriHanzo-Ronin
 */
export default class ThumbnailService {
    static #DEMUXERS =
        "avi,asf,bmp_pipe,flv,gif,hevc,jpeg_pipe,matroska,mjpeg,mov,mpeg,mpegts,mpegvideo,ogg,png_pipe,tiff_pipe,webm,webp_pipe";
    static #MAX_ALLOC = 256 * 1024 * 1024;
    static #MAX_OUTPUT_SIZE = 5 * 1024 * 1024;
    static #MAX_ERROR_OUTPUT_SIZE = 8 * 1024;
    static #MAX_PIXELS = 40_000_000;
    static #TIMEOUT = 30_000;

    /**
     * Creates a JPEG thumbnail from a temporary media session
     *
     * @param {string} id Media session identifier
     * @returns {Promise<Buffer>} JPEG thumbnail
     */
    static async create(id) {
        const mediaUrl = await ThumbnailService.#getMediaUrl(id);
        const childProcess = spawn(ffmpegPath, [
            "-nostdin",
            "-loglevel",
            "error",
            "-max_alloc",
            String(ThumbnailService.#MAX_ALLOC),
            "-threads",
            "2",
            "-filter_threads",
            "2",
            "-filter_complex_threads",
            "2",
            "-protocol_whitelist",
            "http,tcp,pipe",
            "-format_whitelist",
            ThumbnailService.#DEMUXERS,
            "-max_pixels",
            String(ThumbnailService.#MAX_PIXELS),
            "-headers",
            `Origin: ${ENV.thumbnailGeneratorUrl}\r\n`,
            "-i",
            mediaUrl,
            "-map",
            "0:v:0",
            "-frames:v",
            "1",
            "-vf",
            "scale=320:320:force_original_aspect_ratio=decrease",
            "-c:v",
            "mjpeg",
            "-f",
            "image2pipe",
            "pipe:1"
        ]);
        const chunks = [];
        let outputSize = 0;
        let errorOutput = "";
        let timeoutReached = false;
        const timeout = setTimeout(() => {
            timeoutReached = true;
            childProcess.kill("SIGKILL");
        }, ThumbnailService.#TIMEOUT);

        childProcess.stdout.on("data", (chunk) => {
            outputSize += chunk.length;
            if (outputSize > ThumbnailService.#MAX_OUTPUT_SIZE) {
                childProcess.kill("SIGKILL");
                return;
            }

            chunks.push(chunk);
        });
        childProcess.stderr.setEncoding("utf8");
        childProcess.stderr.on("data", (chunk) => {
            const remainingSize = ThumbnailService.#MAX_ERROR_OUTPUT_SIZE - errorOutput.length;
            if (remainingSize > 0) {
                errorOutput += chunk.slice(0, remainingSize);
            }
        });

        const completed = new Promise((resolve, reject) => {
            childProcess.once("error", reject);
            childProcess.once("close", (code) => {
                if (timeoutReached) {
                    reject(ThumbnailService.#createError("Se agotó el tiempo para generar la miniatura", 504));
                    return;
                }

                if (outputSize > ThumbnailService.#MAX_OUTPUT_SIZE) {
                    reject(ThumbnailService.#createError("La miniatura supera el tamaño permitido", 413));
                    return;
                }

                if (code !== 0 || !outputSize) {
                    if (errorOutput) {
                        console.error(errorOutput.trim());
                    }

                    reject(ThumbnailService.#createError("El archivo multimedia no es válido", 422));
                    return;
                }

                resolve(Buffer.concat(chunks, outputSize));
            });
        });

        try {
            return await completed;
        } catch (error) {
            childProcess.kill("SIGKILL");
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Resolves the internal API hostname before invoking static FFmpeg
     *
     * @param {string} id Media session identifier
     * @returns {Promise<string>} Resolved media URL
     */
    static async #getMediaUrl(id) {
        const mediaUrl = new URL(`/ftp/media/${id}`, ENV.apiUrl);
        if (!isIP(mediaUrl.hostname)) {
            [mediaUrl.hostname] = await resolve4(mediaUrl.hostname);
        }

        return mediaUrl.href;
    }

    static #createError(message, status) {
        const error = new Error(message);
        error.status = status;
        return error;
    }
}
