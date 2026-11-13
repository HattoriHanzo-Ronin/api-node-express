import { spawn } from "node:child_process";
import { resolve4 } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { isIP } from "node:net";
import { availableParallelism, totalmem } from "node:os";
import { ENV } from "../../config/environment.js";
import { API_ERROR } from "../../config/errors.js";
import { LOG_EVENT } from "../../config/log-events.js";
import ApiError from "../../utils/error/api-error.js";
import Logger from "../../utils/logger/logger.js";
import type ThumbnailService from "../thumbnail-service.js";
import type { CreateThumbnailParams, RegisterThumbnailBatchParams } from "../../types/thumbnail/thumbnail-service.js";
import type {
    CpuSample,
    ResourceUsage,
    ResourceUsageParams,
    ThumbnailBatch,
    ThumbnailJob
} from "../../types/thumbnail/default-thumbnail-service.js";

const {
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
    private readonly batches = new Map<string, ThumbnailBatch>();
    private schedulerVersion = 0;
    private schedulerSampling = false;

    create({ id, batchId, signal }: CreateThumbnailParams) {
        if (signal?.aborted) {
            return Promise.reject(DefaultThumbnailService.createCancelledError());
        }

        return new Promise<Buffer>((resolve, reject) => {
            const job: ThumbnailJob = {
                id,
                batchId: batchId && this.addToBatch(batchId, id) ? batchId : undefined,
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
                    this.releaseBatch(job.batchId);
                    this.stopScheduler();
                }
            };
            signal?.addEventListener("abort", job.cancel, { once: true });
            this.queue.push(job);
            this.startScheduler();
            this.drainQueue();
        });
    }

    registerBatch({ id, userId, files }: RegisterThumbnailBatchParams) {
        const batch: ThumbnailBatch = {
            startedAt: performance.now(),
            pending: 0,
            userId,
            files: new Map(),
            totalFiles: files.length,
            totalSize: files.reduce((total, file) => total + file.size, 0),
            generated: 0,
            failed: 0,
            expired: 0,
            peakActive: 0
        };
        this.batches.set(id, batch);
        for (const file of files) {
            const timeout = setTimeout(() => {
                batch.files.delete(file.id);
                batch.expired += 1;
                this.finishBatch(id, batch);
            }, thumbnailTimeout);
            timeout.unref();
            batch.files.set(file.id, timeout);
        }

        DefaultThumbnailService.LOGGER.info({
            event: LOG_EVENT.thumbnailBatchStarted,
            message: "Thumbnail batch started",
            context: `User: ${userId}, batch: ${id}, files: ${files.length}, source size: ${batch.totalSize} bytes`
        });
        this.finishBatch(id, batch);
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
                this.releaseBatch(job.batchId);
                continue;
            }

            this.active += 1;
            for (const batch of this.batches.values()) {
                if (batch.pending) {
                    batch.peakActive = Math.max(batch.peakActive, this.active);
                }
            }
            void this.runJob(job);
        }
    }

    private async runJob(job: ThumbnailJob): Promise<void> {
        let generated = false;
        try {
            const thumbnail = await this.generate({ id: job.id, batchId: job.batchId, signal: job.signal });
            generated = true;
            job.resolve(thumbnail);
        } catch (error) {
            if (error instanceof ApiError) {
                job.reject(error);
                return;
            }

            DefaultThumbnailService.LOGGER.error({
                event: thumbnailGenerationFailedEvent,
                message: "Thumbnail generation failed",
                context: `Request: ${job.id}, batch: ${job.batchId ?? "unknown"}`,
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
            this.releaseBatch(job.batchId, generated);
            this.drainQueue();
            this.stopScheduler();
        }
    }

    /**
     * Generates a JPEG thumbnail from a temporary media session
     *
     * @param params.id Media session identifier
     * @param [params.batchId] Batch identifier
     * @param [params.signal] Request cancellation signal
     * @returns JPEG thumbnail
     */
    private async generate({ id, batchId, signal }: CreateThumbnailParams): Promise<Buffer> {
        const mediaUrl = await DefaultThumbnailService.getMediaUrl(id);
        if (!FFMPEG_PATH) {
            DefaultThumbnailService.LOGGER.error({
                event: thumbnailGenerationFailedEvent,
                message: "FFmpeg is unavailable",
                context: `Request: ${id}, batch: ${batchId ?? "unknown"}`
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
                        context: `Request: ${id}, batch: ${batchId ?? "unknown"}`
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

    private addToBatch(id: string, fileId: string): boolean {
        const batch = this.batches.get(id);
        const timeout = batch?.files.get(fileId);
        if (!batch || !timeout) {
            return false;
        }

        clearTimeout(timeout);
        batch.files.delete(fileId);
        batch.pending += 1;
        return true;
    }

    private releaseBatch(id?: string, generated = false): void {
        const batch = id ? this.batches.get(id) : undefined;
        if (!id || !batch) {
            return;
        }

        batch.pending -= 1;
        if (generated) {
            batch.generated += 1;
        } else {
            batch.failed += 1;
        }

        this.finishBatch(id, batch);
    }

    private finishBatch(id: string, batch: ThumbnailBatch): void {
        if (!batch.pending && !batch.files.size) {
            this.logBatch(id, batch, batch.expired > 0);
        }
    }

    private logBatch(id: string, batch: ThumbnailBatch, expired: boolean): void {
        this.batches.delete(id);
        DefaultThumbnailService.LOGGER.info({
            event: expired
                ? LOG_EVENT.thumbnailBatchExpired
                : batch.failed
                  ? LOG_EVENT.thumbnailBatchFailed
                  : LOG_EVENT.thumbnailBatchCompleted,
            message: expired
                ? "Thumbnail batch expired"
                : batch.failed
                  ? "Thumbnail batch finished with failures"
                  : "Thumbnail batch completed",
            context: `User: ${batch.userId}, batch: ${id}, files: ${batch.totalFiles}, generated: ${batch.generated}, failed: ${batch.failed}, expired: ${batch.expired}, source size: ${batch.totalSize} bytes, duration: ${performance.now() - batch.startedAt} ms, peak active jobs: ${batch.peakActive}, container peak CPU: ${batch.peakCpu === undefined ? "unavailable" : `${batch.peakCpu * 100}%`}, CPU target: ${thumbnailCpuTarget}%, CPU target reached: ${batch.peakCpu === undefined ? "unknown" : batch.peakCpu * 100 >= thumbnailCpuTarget}, container peak memory: ${batch.peakMemory === undefined ? "unavailable" : `${batch.peakMemory * 100}%`}, memory target: ${thumbnailMemoryTarget}%, memory target reached: ${batch.peakMemory === undefined ? "unknown" : batch.peakMemory * 100 >= thumbnailMemoryTarget}, sampling interval: ${thumbnailSchedulerInterval} ms`
        });
    }

    private startScheduler(): void {
        if (this.scheduler) {
            return;
        }

        this.scheduler = setInterval(() => this.updateScheduler(), thumbnailSchedulerInterval);
        this.schedulerVersion += 1;
        this.scheduler.unref();
        this.updateScheduler();
    }

    private stopScheduler(): void {
        if (this.queue.length || this.active || !this.scheduler) {
            return;
        }

        clearInterval(this.scheduler);
        this.scheduler = undefined;
        this.schedulerVersion += 1;
        this.lastCpuSample = undefined;
        this.targetConcurrency = thumbnailInitialConcurrency;
    }

    private updateScheduler(): void {
        if (this.schedulerSampling) {
            return;
        }

        this.schedulerSampling = true;
        const version = this.schedulerVersion;
        void this.adjustConcurrency(version)
            .catch((error: unknown) => {
                DefaultThumbnailService.LOGGER.error({
                    event: thumbnailSchedulerFailed,
                    message: "Thumbnail scheduler failed",
                    error
                });
            })
            .finally(() => {
                this.schedulerSampling = false;
                if (this.scheduler && version !== this.schedulerVersion) {
                    this.updateScheduler();
                }
            });
    }

    /**
     * Adjusts queued work admission from the container resource usage
     */
    private async adjustConcurrency(version: number): Promise<void> {
        const usage = await this.getResourceUsage(version);
        if (!usage) {
            return;
        }

        if (!this.scheduler || version !== this.schedulerVersion) {
            return;
        }

        for (const batch of this.batches.values()) {
            if (batch.pending) {
                batch.peakCpu = Math.max(batch.peakCpu ?? 0, usage.cpu);
                batch.peakMemory = Math.max(batch.peakMemory ?? 0, usage.memory);
            }
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
     * @param version Scheduler version
     * @returns CPU and memory usage ratios, or null when unavailable
     */
    private async getResourceUsage(version: number): Promise<ResourceUsage | null> {
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
            if (version !== this.schedulerVersion) {
                return null;
            }

            return this.calculateUsage({
                cpuUsage,
                cpuLimit,
                memoryCurrent: Number(memoryCurrent.trim()),
                memoryLimit: memoryMax.trim() === "max" ? totalmem() : Number(memoryMax.trim())
            });
        } catch {
            return this.getLegacyResourceUsage(version);
        }
    }

    /**
     * Returns container usage from cgroup v1 when cgroup v2 is unavailable
     *
     * @param version Scheduler version
     * @returns CPU and memory usage ratios, or null when unavailable
     */
    private async getLegacyResourceUsage(version: number): Promise<ResourceUsage | null> {
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
            if (version !== this.schedulerVersion) {
                return null;
            }

            return this.calculateUsage({
                cpuUsage: Number(cpuUsage.trim()) / 1000,
                cpuLimit: quota < 0 ? availableParallelism() : quota / period,
                memoryCurrent: Number(memoryCurrent.trim()),
                memoryLimit: Math.min(Number(memoryLimit.trim()), totalmem())
            });
        } catch (error) {
            if (version !== this.schedulerVersion) {
                return null;
            }

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
        if (this.scheduler && Number.isFinite(memory)) {
            for (const batch of this.batches.values()) {
                if (batch.pending) {
                    batch.peakMemory = Math.max(batch.peakMemory ?? 0, memory);
                }
            }
        }

        if (!Number.isFinite(cpuUsage) || !Number.isFinite(cpuLimit) || cpuLimit <= 0 || !Number.isFinite(memory)) {
            return null;
        }

        const now = performance.now();
        const previous = this.lastCpuSample;
        this.lastCpuSample = { usage: cpuUsage, time: now };
        if (!previous || now <= previous.time) {
            return null;
        }

        const cpu = (cpuUsage - previous.usage) / ((now - previous.time) * 1000 * cpuLimit);
        return Number.isFinite(cpu) && cpu >= 0 ? { cpu, memory } : null;
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
