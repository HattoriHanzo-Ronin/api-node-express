import { spawn } from "node:child_process";
import { resolve4 } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { availableParallelism } from "node:os";
import ffmpegPath from "ffmpeg-static";
import { ENV } from "../config/environment.js";
import { API_ERROR } from "../config/errors.js";
import ApiError from "../utils/error/api-error.js";

const {
    apiUrl,
    thumbnailCpuTarget,
    thumbnailGeneratorUrl,
    thumbnailInitialConcurrency,
    thumbnailMaxOutputSize,
    thumbnailMaxPixels,
    thumbnailMemoryTarget,
    thumbnailSchedulerInterval,
    thumbnailTimeout
} = ENV;

/**
 * Streamed media thumbnail generator
 *
 * @author HattoriHanzo-Ronin
 */
export default class ThumbnailService {
    static #DEMUXERS =
        "avi,asf,bmp_pipe,flv,gif,hevc,jpeg_pipe,matroska,mjpeg,mov,mpeg,mpegts,mpegvideo,ogg,png_pipe,tiff_pipe,webm,webp_pipe";
    static #MAX_ALLOC = 256 * 1024 * 1024;
    static #MAX_OUTPUT_SIZE = thumbnailMaxOutputSize;
    static #MAX_ERROR_OUTPUT_SIZE = 8 * 1024;
    static #MAX_PIXELS = thumbnailMaxPixels;
    static #TIMEOUT = thumbnailTimeout;
    static #QUEUE = [];
    static #ACTIVE = 0;
    static #TARGET_CONCURRENCY = thumbnailInitialConcurrency;
    static #SCHEDULER;
    static #LAST_CPU_SAMPLE;

    /**
     * Queues a JPEG thumbnail from a temporary media session
     *
     * @param {string} params.id Media session identifier
     * @param {AbortSignal} [params.signal] Request cancellation signal
     * @returns {Promise<Buffer>} JPEG thumbnail
     */
    static create({ id, signal }) {
        if (signal?.aborted) {
            return Promise.reject(ThumbnailService.#createCancelledError());
        }

        return new Promise((resolve, reject) => {
            const job = { id, signal, resolve, reject };
            const cancel = () => {
                const index = ThumbnailService.#QUEUE.indexOf(job);
                if (index === -1) {
                    return;
                }

                ThumbnailService.#QUEUE.splice(index, 1);
                reject(ThumbnailService.#createCancelledError());
                ThumbnailService.#stopScheduler();
            };
            job.cancel = cancel;
            signal?.addEventListener("abort", cancel, { once: true });
            ThumbnailService.#QUEUE.push(job);
            ThumbnailService.#startScheduler();
            ThumbnailService.#drainQueue();
        });
    }

    /**
     * Starts queued FFmpeg work while the current resource target allows it
     */
    static #drainQueue() {
        while (ThumbnailService.#ACTIVE < ThumbnailService.#TARGET_CONCURRENCY && ThumbnailService.#QUEUE.length) {
            const job = ThumbnailService.#QUEUE.shift();
            if (job.signal?.aborted) {
                job.signal.removeEventListener("abort", job.cancel);
                job.reject(ThumbnailService.#createCancelledError());
                continue;
            }

            ThumbnailService.#ACTIVE += 1;
            void ThumbnailService.#runJob(job);
        }
    }

    static async #runJob(job) {
        try {
            job.resolve(await ThumbnailService.#generate({ id: job.id, signal: job.signal }));
        } catch (error) {
            if (error instanceof ApiError) {
                job.reject(error);
                return;
            }

            job.reject(ThumbnailService.#createError({
                message: "No se pudo generar la miniatura",
                apiError: API_ERROR.thumbnailGenerationFailed
            }));
        } finally {
            job.signal?.removeEventListener("abort", job.cancel);
            ThumbnailService.#ACTIVE -= 1;
            ThumbnailService.#drainQueue();
            ThumbnailService.#stopScheduler();
        }
    }

    /**
     * Generates a JPEG thumbnail from a temporary media session
     *
     * @param {string} params.id Media session identifier
     * @param {AbortSignal} [params.signal] Request cancellation signal
     * @returns {Promise<Buffer>} JPEG thumbnail
     */
    static async #generate({ id, signal }) {
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
            `Origin: ${thumbnailGeneratorUrl}\r\n`,
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
        let cancelled = false;
        const timeout = setTimeout(() => {
            timeoutReached = true;
            childProcess.kill("SIGKILL");
        }, ThumbnailService.#TIMEOUT);
        const cancel = () => {
            cancelled = true;
            childProcess.kill("SIGKILL");
        };
        signal?.addEventListener("abort", cancel, { once: true });

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
                if (cancelled) {
                    reject(ThumbnailService.#createCancelledError());
                    return;
                }

                if (timeoutReached) {
                    reject(
                        ThumbnailService.#createError({
                            message: "Se agotó el tiempo para generar la miniatura",
                            status: 504,
                            apiError: API_ERROR.thumbnailGenerationTimeout
                        })
                    );
                    return;
                }

                if (outputSize > ThumbnailService.#MAX_OUTPUT_SIZE) {
                    reject(
                        ThumbnailService.#createError({
                            message: "La miniatura supera el tamaño permitido",
                            status: 413,
                            apiError: API_ERROR.thumbnailOutputTooLarge
                        })
                    );
                    return;
                }

                if (code !== 0 || !outputSize) {
                    if (errorOutput) {
                        console.error(errorOutput.trim());
                    }

                    reject(
                        ThumbnailService.#createError({
                            message: "El archivo multimedia no es válido",
                            status: 422,
                            apiError: API_ERROR.thumbnailMediaInvalid
                        })
                    );
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
            signal?.removeEventListener("abort", cancel);
        }
    }

    static #startScheduler() {
        if (ThumbnailService.#SCHEDULER) {
            return;
        }

        ThumbnailService.#SCHEDULER = setInterval(() => void ThumbnailService.#adjustConcurrency(), thumbnailSchedulerInterval);
        ThumbnailService.#SCHEDULER.unref();
        void ThumbnailService.#adjustConcurrency();
    }

    static #stopScheduler() {
        if (ThumbnailService.#QUEUE.length || ThumbnailService.#ACTIVE || !ThumbnailService.#SCHEDULER) {
            return;
        }

        clearInterval(ThumbnailService.#SCHEDULER);
        ThumbnailService.#SCHEDULER = undefined;
        ThumbnailService.#LAST_CPU_SAMPLE = undefined;
        ThumbnailService.#TARGET_CONCURRENCY = thumbnailInitialConcurrency;
    }

    /**
     * Adjusts queued work admission from the container resource usage
     */
    static async #adjustConcurrency() {
        const usage = await ThumbnailService.#getResourceUsage();
        if (!usage) {
            return;
        }

        const hasCapacity = usage.cpu < thumbnailCpuTarget / 100 && usage.memory < thumbnailMemoryTarget / 100;
        if (hasCapacity) {
            ThumbnailService.#TARGET_CONCURRENCY += 1;
        } else {
            ThumbnailService.#TARGET_CONCURRENCY = Math.max(1, ThumbnailService.#ACTIVE - 1);
        }

        ThumbnailService.#drainQueue();
    }

    /**
     * Returns current CPU and memory usage from the container cgroup
     *
     * @returns {Promise<{ cpu: number, memory: number } | null>} Container usage or null when unavailable
     */
    static async #getResourceUsage() {
        try {
            const [cpuStat, cpuMax, memoryCurrent, memoryMax] = await Promise.all([
                readFile("/sys/fs/cgroup/cpu.stat", "utf8"),
                readFile("/sys/fs/cgroup/cpu.max", "utf8"),
                readFile("/sys/fs/cgroup/memory.current", "utf8"),
                readFile("/sys/fs/cgroup/memory.max", "utf8")
            ]);
            const cpuUsage = Number(cpuStat.match(/^usage_usec\s+(\d+)$/m)?.[1]);
            const [quota, period] = cpuMax.trim().split(" ");
            const cpuLimit = quota === "max" ? availableParallelism() : Number(quota) / Number(period);
            return ThumbnailService.#calculateUsage({
                cpuUsage,
                cpuLimit,
                memoryCurrent: Number(memoryCurrent.trim()),
                memoryLimit: Number(memoryMax.trim())
            });
        } catch {
            return ThumbnailService.#getLegacyResourceUsage();
        }
    }

    /**
     * Returns container usage from cgroup v1 when cgroup v2 is unavailable
     *
     * @returns {Promise<{ cpu: number, memory: number } | null>} Container usage or null when unavailable
     */
    static async #getLegacyResourceUsage() {
        try {
            const [cpuUsage, cpuQuota, cpuPeriod, memoryCurrent, memoryLimit] = await Promise.all([
                readFile("/sys/fs/cgroup/cpuacct/cpuacct.usage", "utf8"),
                readFile("/sys/fs/cgroup/cpu/cpu.cfs_quota_us", "utf8"),
                readFile("/sys/fs/cgroup/cpu/cpu.cfs_period_us", "utf8"),
                readFile("/sys/fs/cgroup/memory/memory.usage_in_bytes", "utf8"),
                readFile("/sys/fs/cgroup/memory/memory.limit_in_bytes", "utf8")
            ]);
            const quota = Number(cpuQuota.trim());
            const period = Number(cpuPeriod.trim());
            return ThumbnailService.#calculateUsage({
                cpuUsage: Number(cpuUsage.trim()) / 1000,
                cpuLimit: quota < 0 ? availableParallelism() : quota / period,
                memoryCurrent: Number(memoryCurrent.trim()),
                memoryLimit: Number(memoryLimit.trim())
            });
        } catch {
            return null;
        }
    }

    /**
     * Calculates the CPU delta and current memory ratio from cgroup samples
     *
     * @param {number} params.cpuUsage Consumed CPU microseconds
     * @param {number} params.cpuLimit CPU cores available to the container
     * @param {number} params.memoryCurrent Consumed memory bytes
     * @param {number} params.memoryLimit Available memory bytes
     * @returns {{ cpu: number, memory: number } | null} Container usage or null before a complete sample
     */
    static #calculateUsage({ cpuUsage, cpuLimit, memoryCurrent, memoryLimit }) {
        const memory = memoryCurrent / memoryLimit;
        const now = performance.now();
        const previous = ThumbnailService.#LAST_CPU_SAMPLE;
        ThumbnailService.#LAST_CPU_SAMPLE = { usage: cpuUsage, time: now };
        if (!previous || !Number.isFinite(cpuUsage) || !Number.isFinite(cpuLimit) || !Number.isFinite(memory)) {
            return null;
        }

        return { cpu: (cpuUsage - previous.usage) / ((now - previous.time) * 1000 * cpuLimit), memory };
    }

    /**
     * Resolves the internal API hostname before invoking static FFmpeg
     *
     * @param {string} id Media session identifier
     * @returns {Promise<string>} Resolved media URL
     */
    static async #getMediaUrl(id) {
        const mediaUrl = new URL(`/ftp/media/${id}`, apiUrl);
        if (!isIP(mediaUrl.hostname)) {
            [mediaUrl.hostname] = await resolve4(mediaUrl.hostname);
        }

        return mediaUrl.href;
    }

    static #createError({ message, status, apiError }) {
        return new ApiError({ message, status, apiError });
    }

    static #createCancelledError() {
        return ThumbnailService.#createError({
            message: "La solicitud fue cancelada",
            status: 499,
            apiError: API_ERROR.thumbnailRequestCancelled
        });
    }
}
