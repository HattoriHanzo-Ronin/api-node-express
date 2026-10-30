import { spawn } from "node:child_process";
import { resolve4 } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { isIP } from "node:net";
import { availableParallelism } from "node:os";
import { ENV } from "../../config/environment.js";
import { API_ERROR } from "../../config/errors.js";
import ApiError from "../../utils/error/api-error.js";
import type { CreateThumbnailParams } from "../../types/thumbnail-service.js";
import type {
    CpuSample,
    ResourceUsage,
    ResourceUsageParams,
    ThumbnailJob
} from "../../types/default-thumbnail-service.js";
import type { ApiErrorOptions } from "../../types/api-error.js";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static") as string | null;
const {
    apiUrl,
    thumbnailCpuTarget,
    thumbnailInitialConcurrency,
    thumbnailMaxOutputSize,
    thumbnailMaxPixels,
    thumbnailMemoryTarget,
    thumbnailSchedulerInterval,
    thumbnailTimeout
} = ENV;
const {
    thumbnailRequestCancelled,
    thumbnailGenerationTimeout,
    thumbnailOutputTooLarge,
    thumbnailMediaInvalid,
    thumbnailGenerationFailed
} = API_ERROR;

/**
 * Streamed media thumbnail generator
 *
 * @author HattoriHanzo-Ronin
 */
export class DefaultThumbnailService {
    private static DEMUXERS =
        "avi,asf,bmp_pipe,flv,gif,hevc,jpeg_pipe,matroska,mjpeg,mov,mpeg,mpegts,mpegvideo,ogg,png_pipe,tiff_pipe,webm,webp_pipe";
    private static MAX_ALLOC = 256 * 1024 * 1024;
    private static MAX_OUTPUT_SIZE = thumbnailMaxOutputSize;
    private static MAX_PIXELS = thumbnailMaxPixels;
    private static TIMEOUT = thumbnailTimeout;
    private static QUEUE: ThumbnailJob[] = [];
    private static ACTIVE = 0;
    private static TARGET_CONCURRENCY = thumbnailInitialConcurrency;
    private static SCHEDULER: NodeJS.Timeout | undefined;
    private static LAST_CPU_SAMPLE: CpuSample | undefined;

    static create({ id, signal }: CreateThumbnailParams): Promise<Buffer> {
        if (signal?.aborted) {
            return Promise.reject(DefaultThumbnailService.createCancelledError());
        }

        return new Promise<Buffer>((resolve, reject) => {
            const job: ThumbnailJob = {
                id,
                signal,
                resolve,
                reject,
                cancel: () => {
                    const index = DefaultThumbnailService.QUEUE.indexOf(job);
                    if (index === -1) {
                        return;
                    }

                    DefaultThumbnailService.QUEUE.splice(index, 1);
                    reject(DefaultThumbnailService.createCancelledError());
                    DefaultThumbnailService.stopScheduler();
                }
            };
            signal?.addEventListener("abort", job.cancel, { once: true });
            DefaultThumbnailService.QUEUE.push(job);
            DefaultThumbnailService.startScheduler();
            DefaultThumbnailService.drainQueue();
        });
    }

    /**
     * Starts queued FFmpeg work while the current resource target allows it
     */
    private static drainQueue(): void {
        while (
            DefaultThumbnailService.ACTIVE < DefaultThumbnailService.TARGET_CONCURRENCY &&
            DefaultThumbnailService.QUEUE.length
        ) {
            const job = DefaultThumbnailService.QUEUE.shift();
            if (!job) {
                return;
            }
            if (job.signal?.aborted) {
                job.signal.removeEventListener("abort", job.cancel);
                job.reject(DefaultThumbnailService.createCancelledError());
                continue;
            }

            DefaultThumbnailService.ACTIVE += 1;
            void DefaultThumbnailService.runJob(job);
        }
    }

    private static async runJob(job: ThumbnailJob): Promise<void> {
        try {
            job.resolve(await DefaultThumbnailService.generate({ id: job.id, signal: job.signal }));
        } catch (error) {
            if (error instanceof ApiError) {
                job.reject(error);
                return;
            }

            job.reject(
                DefaultThumbnailService.createError({
                    message: "No se pudo generar la miniatura",
                    apiError: thumbnailGenerationFailed
                })
            );
        } finally {
            job.signal?.removeEventListener("abort", job.cancel);
            DefaultThumbnailService.ACTIVE -= 1;
            DefaultThumbnailService.drainQueue();
            DefaultThumbnailService.stopScheduler();
        }
    }

    /**
     * Generates a JPEG thumbnail from a temporary media session
     *
     * @param params.id Media session identifier
     * @param [params.signal] Request cancellation signal
     * @returns JPEG thumbnail
     */
    private static async generate({ id, signal }: CreateThumbnailParams): Promise<Buffer> {
        const mediaUrl = await DefaultThumbnailService.getMediaUrl(id);
        if (!ffmpegPath) {
            throw DefaultThumbnailService.createError({
                message: "No se pudo generar la miniatura",
                apiError: thumbnailGenerationFailed
            });
        }

        const childProcess = spawn(ffmpegPath, [
            "-nostdin",
            "-loglevel",
            "error",
            "-max_alloc",
            String(DefaultThumbnailService.MAX_ALLOC),
            "-threads",
            "2",
            "-filter_threads",
            "2",
            "-filter_complex_threads",
            "2",
            "-protocol_whitelist",
            "http,tcp,pipe",
            "-format_whitelist",
            DefaultThumbnailService.DEMUXERS,
            "-max_pixels",
            String(DefaultThumbnailService.MAX_PIXELS),
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
        const chunks: Buffer[] = [];
        let outputSize = 0;
        let timeoutReached = false;
        let cancelled = false;
        const timeout = setTimeout(() => {
            timeoutReached = true;
            childProcess.kill("SIGKILL");
        }, DefaultThumbnailService.TIMEOUT);
        const cancel = () => {
            cancelled = true;
            childProcess.kill("SIGKILL");
        };
        signal?.addEventListener("abort", cancel, { once: true });

        childProcess.stdout.on("data", (chunk) => {
            outputSize += chunk.length;
            if (outputSize > DefaultThumbnailService.MAX_OUTPUT_SIZE) {
                childProcess.kill("SIGKILL");
                return;
            }

            chunks.push(chunk);
        });
        const completed = new Promise<Buffer>((resolve, reject) => {
            childProcess.once("error", reject);
            childProcess.once("close", (code) => {
                if (cancelled) {
                    reject(DefaultThumbnailService.createCancelledError());
                    return;
                }

                if (timeoutReached) {
                    reject(
                        DefaultThumbnailService.createError({
                            message: "Se agotó el tiempo para generar la miniatura",
                            status: 504,
                            apiError: thumbnailGenerationTimeout
                        })
                    );
                    return;
                }

                if (outputSize > DefaultThumbnailService.MAX_OUTPUT_SIZE) {
                    reject(
                        DefaultThumbnailService.createError({
                            message: "La miniatura supera el tamaño permitido",
                            status: 413,
                            apiError: thumbnailOutputTooLarge
                        })
                    );
                    return;
                }

                if (code !== 0 || !outputSize) {
                    reject(
                        DefaultThumbnailService.createError({
                            message: "El archivo multimedia no es válido",
                            status: 422,
                            apiError: thumbnailMediaInvalid
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

    private static startScheduler(): void {
        if (DefaultThumbnailService.SCHEDULER) {
            return;
        }

        DefaultThumbnailService.SCHEDULER = setInterval(
            () => void DefaultThumbnailService.adjustConcurrency(),
            thumbnailSchedulerInterval
        );
        DefaultThumbnailService.SCHEDULER.unref();
        void DefaultThumbnailService.adjustConcurrency();
    }

    private static stopScheduler(): void {
        if (
            DefaultThumbnailService.QUEUE.length ||
            DefaultThumbnailService.ACTIVE ||
            !DefaultThumbnailService.SCHEDULER
        ) {
            return;
        }

        clearInterval(DefaultThumbnailService.SCHEDULER);
        DefaultThumbnailService.SCHEDULER = undefined;
        DefaultThumbnailService.LAST_CPU_SAMPLE = undefined;
        DefaultThumbnailService.TARGET_CONCURRENCY = thumbnailInitialConcurrency;
    }

    /**
     * Adjusts queued work admission from the container resource usage
     */
    private static async adjustConcurrency(): Promise<void> {
        const usage = await DefaultThumbnailService.getResourceUsage();
        if (!usage) {
            return;
        }

        const hasCapacity = usage.cpu < thumbnailCpuTarget / 100 && usage.memory < thumbnailMemoryTarget / 100;
        if (hasCapacity) {
            DefaultThumbnailService.TARGET_CONCURRENCY += 1;
        } else {
            DefaultThumbnailService.TARGET_CONCURRENCY = Math.max(1, DefaultThumbnailService.ACTIVE - 1);
        }

        DefaultThumbnailService.drainQueue();
    }

    /**
     * Returns current CPU and memory usage from the container cgroup
     *
     * @returns CPU and memory usage ratios, or null when unavailable
     */
    private static async getResourceUsage(): Promise<ResourceUsage | null> {
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
            return DefaultThumbnailService.calculateUsage({
                cpuUsage,
                cpuLimit,
                memoryCurrent: Number(memoryCurrent.trim()),
                memoryLimit: Number(memoryMax.trim())
            });
        } catch {
            return DefaultThumbnailService.getLegacyResourceUsage();
        }
    }

    /**
     * Returns container usage from cgroup v1 when cgroup v2 is unavailable
     *
     * @returns CPU and memory usage ratios, or null when unavailable
     */
    private static async getLegacyResourceUsage(): Promise<ResourceUsage | null> {
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
            return DefaultThumbnailService.calculateUsage({
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
     * @param params.cpuUsage Consumed CPU microseconds
     * @param params.cpuLimit CPU cores available to the container
     * @param params.memoryCurrent Consumed memory bytes
     * @param params.memoryLimit Available memory bytes
     * @returns CPU and memory usage ratios, or null before a complete sample
     */
    private static calculateUsage({
        cpuUsage,
        cpuLimit,
        memoryCurrent,
        memoryLimit
    }: ResourceUsageParams): ResourceUsage | null {
        const memory = memoryCurrent / memoryLimit;
        const now = performance.now();
        const previous = DefaultThumbnailService.LAST_CPU_SAMPLE;
        DefaultThumbnailService.LAST_CPU_SAMPLE = { usage: cpuUsage, time: now };
        if (!previous || !Number.isFinite(cpuUsage) || !Number.isFinite(cpuLimit) || !Number.isFinite(memory)) {
            return null;
        }

        return { cpu: (cpuUsage - previous.usage) / ((now - previous.time) * 1000 * cpuLimit), memory };
    }

    /**
     * Resolves the internal API hostname before invoking static FFmpeg
     *
     * @param id Media session identifier
     * @returns Resolved media URL
     */
    private static async getMediaUrl(id: string): Promise<string> {
        const mediaUrl = new URL(`/ftp/media/${id}`, apiUrl);
        if (!isIP(mediaUrl.hostname)) {
            [mediaUrl.hostname] = await resolve4(mediaUrl.hostname);
        }

        return mediaUrl.href;
    }

    private static createError({ message, status, apiError }: ApiErrorOptions): ApiError {
        return new ApiError({ message, status, apiError });
    }

    private static createCancelledError(): ApiError {
        return DefaultThumbnailService.createError({
            message: "La solicitud fue cancelada",
            status: 499,
            apiError: thumbnailRequestCancelled
        });
    }
}
