import { readFile } from "node:fs/promises";
import { availableParallelism, totalmem } from "node:os";
import { LOG_EVENT } from "../../config/log-events.js";
import Logger from "../logger/logger.js";
import type { ResourceMonitorDependencies, ResourcePeak, ResourceSample } from "../../types/utils/resource-monitor.js";

/**
 * Reports peak container resources
 *
 * @author HattoriHanzo-Ronin
 */
export default class ResourceMonitor {
    private static readonly LOGGER = Logger.getLogger(ResourceMonitor);
    private static readonly SAMPLE_INTERVAL = 1_000;
    private readonly dependencies: ResourceMonitorDependencies;
    private interval?: NodeJS.Timeout;
    private reportTimer?: NodeJS.Timeout;
    private pending?: Promise<void>;
    private previous?: { usage: number; time: number };
    private cpuPeak?: ResourcePeak;
    private memoryPeak?: ResourcePeak;
    private warned = false;

    constructor(dependencies: ResourceMonitorDependencies) {
        this.dependencies = dependencies;
    }

    /**
     * Starts sampling and schedules the daily report
     */
    start(): void {
        if (this.interval) {
            return;
        }

        this.interval = setInterval(() => void this.sample(), ResourceMonitor.SAMPLE_INTERVAL);
        this.interval.unref();
        if (!this.reportTimer) {
            this.scheduleReport();
        }

        void (this.pending ?? Promise.resolve()).then(() => {
            if (this.interval && this.dependencies.activeSessions()) {
                this.previous = undefined;
                void this.sample();
            }
        });
    }

    /**
     * Pauses sampling when no sessions remain
     */
    pause(): void {
        clearInterval(this.interval);
        this.interval = undefined;
        this.previous = undefined;
    }

    /**
     * Stops sampling and reports the remaining peak
     */
    async stop(): Promise<void> {
        if (!this.interval && !this.reportTimer) {
            return;
        }

        clearInterval(this.interval);
        clearTimeout(this.reportTimer);
        this.interval = undefined;
        await this.pending;
        this.report("shutdown");
    }

    private sample(): Promise<void> {
        if (this.pending) {
            return this.pending;
        }

        this.pending = this.collect().finally(() => {
            this.pending = undefined;
        });
        return this.pending;
    }

    private async collect(): Promise<void> {
        const sessions = this.dependencies.activeSessions();
        try {
            const { cpuUsage, cpuLimit, memoryBytes, memoryLimit } = await this.readUsage();
            if (
                !Number.isFinite(cpuUsage) ||
                !Number.isFinite(cpuLimit) ||
                cpuLimit <= 0 ||
                !Number.isFinite(memoryBytes) ||
                !Number.isFinite(memoryLimit) ||
                memoryLimit <= 0
            ) {
                throw new Error("Invalid container resource statistics");
            }

            const time = performance.now();
            const timestamp = new Date().toISOString();
            const memory = memoryBytes / memoryLimit;
            if (sessions > 0 && Number.isFinite(memory) && (!this.memoryPeak || memory > this.memoryPeak.value)) {
                this.memoryPeak = { value: memory, sessions, timestamp };
            }

            if (sessions > 0 && this.previous && time - this.previous.time >= 1_000) {
                const cpu = (cpuUsage - this.previous.usage) / ((time - this.previous.time) * 1000 * cpuLimit);
                if (Number.isFinite(cpu) && cpu >= 0 && (!this.cpuPeak || cpu > this.cpuPeak.value)) {
                    this.cpuPeak = { value: cpu, sessions, timestamp };
                }
            }

            if (!this.previous || time - this.previous.time >= 1_000) {
                this.previous = { usage: cpuUsage, time };
            }

            this.warned = false;
        } catch (error) {
            if (!this.warned) {
                ResourceMonitor.LOGGER.warn({
                    event: LOG_EVENT.resourceMonitorFailed,
                    message: "Container resource usage is unavailable",
                    error
                });
                this.warned = true;
            }
        }
    }

    private async readUsage(): Promise<ResourceSample> {
        try {
            const [stat, maximum, memory, limit] = await Promise.all([
                readFile("/sys/fs/cgroup/cpu.stat", "utf8"),
                readFile("/sys/fs/cgroup/cpu.max", "utf8"),
                readFile("/sys/fs/cgroup/memory.current", "utf8"),
                readFile("/sys/fs/cgroup/memory.max", "utf8")
            ]);
            const [quota, period] = maximum.trim().split(" ");
            return {
                cpuUsage: Number(stat.match(/^usage_usec\s+(\d+)$/m)?.[1]),
                cpuLimit: quota === "max" ? availableParallelism() : Number(quota) / Number(period),
                memoryBytes: Number(memory.trim()),
                memoryLimit: limit.trim() === "max" ? totalmem() : Number(limit.trim())
            };
        } catch {
            const [cpu, quota, period, memory, limit] = await Promise.all([
                readFile("/sys/fs/cgroup/cpuacct/cpuacct.usage", "utf8"),
                readFile("/sys/fs/cgroup/cpu/cpu.cfs_quota_us", "utf8"),
                readFile("/sys/fs/cgroup/cpu/cpu.cfs_period_us", "utf8"),
                readFile("/sys/fs/cgroup/memory/memory.usage_in_bytes", "utf8"),
                readFile("/sys/fs/cgroup/memory/memory.limit_in_bytes", "utf8")
            ]);
            return {
                cpuUsage: Number(cpu.trim()) / 1000,
                cpuLimit:
                    Number(quota.trim()) < 0 ? availableParallelism() : Number(quota.trim()) / Number(period.trim()),
                memoryBytes: Number(memory.trim()),
                memoryLimit: Math.min(Number(limit.trim()), totalmem())
            };
        }
    }

    private scheduleReport(): void {
        const next = new Date();
        next.setHours(this.dependencies.reportHour, 0, 0, 0);
        if (next.getTime() <= Date.now()) {
            next.setDate(next.getDate() + 1);
        }

        this.reportTimer = setTimeout(() => {
            void (this.interval ? this.sample() : Promise.resolve()).then(() => {
                this.report("scheduled");
                this.scheduleReport();
            });
        }, next.getTime() - Date.now());
        this.reportTimer.unref();
    }

    private report(reason: string): void {
        if (!this.cpuPeak && !this.memoryPeak) {
            return;
        }

        const cpu = this.cpuPeak
            ? `${this.cpuPeak.value * 100}%, sessions: ${this.cpuPeak.sessions}, at: ${this.cpuPeak.timestamp}`
            : "unavailable";
        const memory = this.memoryPeak
            ? `${this.memoryPeak.value * 100}%, sessions: ${this.memoryPeak.sessions}, at: ${this.memoryPeak.timestamp}`
            : "unavailable";
        ResourceMonitor.LOGGER.info({
            event: LOG_EVENT.resourcePeak,
            message: "Router panel container resource peak",
            context: `Reason: ${reason}, CPU peak: ${cpu}, CPU limit reached: ${this.cpuPeak ? this.cpuPeak.value >= 1 : "unknown"}, memory peak: ${memory}, memory limit reached: ${this.memoryPeak ? this.memoryPeak.value >= 1 : "unknown"}, sampling interval: ${ResourceMonitor.SAMPLE_INTERVAL} ms`
        });
        this.cpuPeak = undefined;
        this.memoryPeak = undefined;
    }
}
