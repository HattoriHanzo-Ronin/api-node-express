import { spawn } from "node:child_process";
import { resolve4 } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { isIP } from "node:net";
import { availableParallelism } from "node:os";
import { ENV } from "../../config/environment.js";
import { API_ERROR } from "../../config/errors.js";
import { LOG_EVENT } from "../../config/log-events.js";
import ApiError from "../../utils/error/api-error.js";
import Logger from "../../utils/logger/logger.js";
import type ThumbnailService from "../thumbnail-service.js";
import type { CreateThumbnailParams } from "../../types/thumbnail/thumbnail-service.js";
import type {
    CpuSample,
    ResourceUsage,
    ResourceUsageParams,
    ThumbnailJob
} from "../../types/thumbnail/default-thumbnail-service.js";

const {
    thumbnailSchedulerStarted,
    thumbnailSchedulerStopped,
    thumbnailSchedulerFailed,
    thumbnailSchedulerResourcesUnavailable,
    thumbnailGenerationFailed: thumbnailGenerationFailedEvent,
    thumbnailGenerationTimeout: thumbnailGenerationTimeoutEvent
} = LOG_EVENT;

const REQUIRE = createRequire(import.meta.url);
const FFMPEG_PATH: typeof import("ffmpeg-static").default = REQUIRE("ffmpeg-static");
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
export default class DefaultThumbnailService implements ThumbnailService {
    private static readonly LOGGER = Logger.getLogger(DefaultThumbnailService);
    private static readonly DEMUXERS =
        "avi,asf,bmp_pipe,flv,gif,hevc,jpeg_pipe,matroska,mjpeg,mov,mpeg,mpegts,mpegvideo,ogg,png_pipe,tiff_pipe,webm,webp_pipe";
    private static readonly MAX_ALLOC = 256 * 1024 * 1024;
    private queue: ThumbnailJob[] = [];
    private active = 0;
    private targetConcurrency = thumbnailInitialConcurrency;
    private scheduler?: NodeJS.Timeout;
    private lastCpuSample?: CpuSample;
    private resourceWarningLogged = false;

    create({ id, signal }: CreateThumbnailParams) {
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
                    const index = this.queue.indexOf(job);
                    if (index === -1) {
                        return;
                    }

                    this.queue.splice(index, 1);
                    reject(DefaultThumbnailService.createCancelledError());
                    this.stopScheduler();
                }
            };
            signal?.addEventListener("abort", job.cancel, { once: true });
            this.queue.push(job);
            this.startScheduler();
            this.drainQueue();
        });
    }

    /**
     * Starts queued FFmpeg work while the current resource target allows it
     */
    private drainQueue(): void {
        while (this.active < this.targetConcurrency && this.queue.length) {
            const job = this.queue.shift();
            if (!job) {
                return;
            }

            if (job.signal?.aborted) {
                job.signal.removeEventListener("abort", job.cancel);
                job.reject(DefaultThumbnailService.createCancelledError());
                continue;
            }

            this.active += 1;
            void this.runJob(job);
        }
    }

    private async runJob(job: ThumbnailJob): Promise<void> {
        try {
            job.resolve(await this.generate({ id: job.id, signal: job.signal }));
        } catch (error) {
            if (error instanceof ApiError) {
                job.reject(error);
                return;
            }

            DefaultThumbnailService.LOGGER.error({
                event: thumbnailGenerationFailedEvent,
                message: "Thumbnail generation failed",
                context: `Request: ${job.id}`,
                error
            });
            job.reject(
                new ApiError({
                    message: "No se pudo generar la miniatura",
                    apiError: thumbnailGenerationFailed,
                    cause: error
                })
            );
        } finally {
            job.signal?.removeEventListener("abort", job.cancel);
            this.active -= 1;
            this.drainQueue();
            this.stopScheduler();
        }
    }

    /**
     * Generates a JPEG thumbnail from a temporary media session
     *
     * @param params.id Media session identifier
     * @param [params.signal] Request cancellation signal
     * @returns JPEG thumbnail
     */
    private async generate({ id, signal }: CreateThumbnailParams): Promise<Buffer> {
        const mediaUrl = await DefaultThumbnailService.getMediaUrl(id);
        if (!FFMPEG_PATH) {
            DefaultThumbnailService.LOGGER.error({
                event: thumbnailGenerationFailedEvent,
                message: "FFmpeg is unavailable",
                context: `Request: ${id}`
            });
            throw new ApiError({
                message: "No se pudo generar la miniatura",
                apiError: thumbnailGenerationFailed
            });
        }

        const childProcess = spawn(FFMPEG_PATH, [
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
            String(thumbnailMaxPixels),
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
        }, thumbnailTimeout);
        const cancel = () => {
            cancelled = true;
            childProcess.kill("SIGKILL");
        };
        signal?.addEventListener("abort", cancel, { once: true });

        childProcess.stdout.on("data", (chunk) => {
            outputSize += chunk.length;
            if (outputSize > thumbnailMaxOutputSize) {
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
                    DefaultThumbnailService.LOGGER.warn({
                        event: thumbnailGenerationTimeoutEvent,
                        message: "Thumbnail generation timed out",
                        context: `Request: ${id}`
                    });
                    reject(
                        new ApiError({
                            message: "Se agotó el tiempo para generar la miniatura",
                            status: 504,
                            apiError: thumbnailGenerationTimeout
                        })
                    );
                    return;
                }

                if (outputSize > thumbnailMaxOutputSize) {
                    reject(
                        new ApiError({
                            message: "La miniatura supera el tamaño permitido",
                            status: 413,
                            apiError: thumbnailOutputTooLarge
                        })
                    );
                    return;
                }

                if (code !== 0 || !outputSize) {
                    reject(
                        new ApiError({
                            message: "El archivo multimedia no es válido",
                            status: 422,
                            apiError: thumbnailMediaInvalid,
                            context: { exitCode: code }
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

    private startScheduler(): void {
        if (this.scheduler) {
            return;
        }

        this.scheduler = setInterval(() => this.updateScheduler(), thumbnailSchedulerInterval);
        this.scheduler.unref();
        DefaultThumbnailService.LOGGER.info({
            event: thumbnailSchedulerStarted,
            message: "Thumbnail scheduler started"
        });
        this.updateScheduler();
    }

    private stopScheduler(): void {
        if (this.queue.length || this.active || !this.scheduler) {
            return;
        }

        clearInterval(this.scheduler);
        this.scheduler = undefined;
        this.lastCpuSample = undefined;
        this.targetConcurrency = thumbnailInitialConcurrency;
        DefaultThumbnailService.LOGGER.info({
            event: thumbnailSchedulerStopped,
            message: "Thumbnail scheduler stopped"
        });
    }

    private updateScheduler(): void {
        void this.adjustConcurrency().catch((error: unknown) => {
            DefaultThumbnailService.LOGGER.error({
                event: thumbnailSchedulerFailed,
                message: "Thumbnail scheduler failed",
                error
            });
        });
    }

    /**
     * Adjusts queued work admission from the container resource usage
     */
    private async adjustConcurrency(): Promise<void> {
        const usage = await this.getResourceUsage();
        if (!usage) {
            return;
        }

        const hasCapacity = usage.cpu < thumbnailCpuTarget / 100 && usage.memory < thumbnailMemoryTarget / 100;
        if (hasCapacity) {
            this.targetConcurrency += 1;
        } else {
            this.targetConcurrency = Math.max(1, this.active - 1);
        }

        this.drainQueue();
    }

    /**
     * Returns current CPU and memory usage from the container cgroup
     *
     * @returns CPU and memory usage ratios, or null when unavailable
     */
    private async getResourceUsage(): Promise<ResourceUsage | null> {
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
            return this.calculateUsage({
                cpuUsage,
                cpuLimit,
                memoryCurrent: Number(memoryCurrent.trim()),
                memoryLimit: Number(memoryMax.trim())
            });
        } catch {
            return this.getLegacyResourceUsage();
        }
    }

    /**
     * Returns container usage from cgroup v1 when cgroup v2 is unavailable
     *
     * @returns CPU and memory usage ratios, or null when unavailable
     */
    private async getLegacyResourceUsage(): Promise<ResourceUsage | null> {
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
            return this.calculateUsage({
                cpuUsage: Number(cpuUsage.trim()) / 1000,
                cpuLimit: quota < 0 ? availableParallelism() : quota / period,
                memoryCurrent: Number(memoryCurrent.trim()),
                memoryLimit: Number(memoryLimit.trim())
            });
        } catch (error) {
            if (!this.resourceWarningLogged) {
                DefaultThumbnailService.LOGGER.warn({
                    event: thumbnailSchedulerResourcesUnavailable,
                    message: "Resource usage is unavailable; retaining the current concurrency target",
                    error
                });
                this.resourceWarningLogged = true;
            }

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
    private calculateUsage({
        cpuUsage,
        cpuLimit,
        memoryCurrent,
        memoryLimit
    }: ResourceUsageParams): ResourceUsage | null {
        const memory = memoryCurrent / memoryLimit;
        const now = performance.now();
        const previous = this.lastCpuSample;
        this.lastCpuSample = { usage: cpuUsage, time: now };
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

    private static createCancelledError(): ApiError {
        return new ApiError({
            message: "La solicitud fue cancelada",
            status: 499,
            apiError: thumbnailRequestCancelled
        });
    }
}
