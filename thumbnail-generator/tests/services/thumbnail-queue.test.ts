import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockChildProcess, ResourceUsage, ThumbnailService } from "../types/thumbnail-service.js";

const { childProcesses, mockReadFile, mockSpawn } = vi.hoisted(() => ({
    childProcesses: [] as MockChildProcess[],
    mockReadFile: vi.fn(),
    mockSpawn: vi.fn()
}));
const logger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("node:child_process", () => ({ spawn: mockSpawn }));
vi.mock("node:fs/promises", () => ({ readFile: mockReadFile }));
vi.mock("../../src/utils/logger/logger.js", () => ({ default: { getLogger: () => logger } }));

describe("ThumbnailService queue", () => {
    let resourceUsage: ResourceUsage;
    let service: ThumbnailService;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.useFakeTimers();
        childProcesses.length = 0;
        resourceUsage = { cpu: 0, memory: 100 };
        vi.stubEnv("LOG_LEVEL", "info");
        vi.stubEnv("LOG_DIRECTORY", "/tmp/thumbnail-test-logs");
        vi.stubEnv("LOG_RETENTION_WEEKS", "8");
        vi.stubEnv("PORT", "3000");
        vi.stubEnv("API_URL", "http://127.0.0.1:59998");
        vi.stubEnv("THUMBNAIL_INITIAL_CONCURRENCY", "2");
        vi.stubEnv("THUMBNAIL_CPU_TARGET", "80");
        vi.stubEnv("THUMBNAIL_MEMORY_TARGET", "80");
        vi.stubEnv("THUMBNAIL_SCHEDULER_INTERVAL", "1000");
        vi.stubEnv("THUMBNAIL_MAX_OUTPUT_SIZE", "5242880");
        vi.stubEnv("THUMBNAIL_MAX_PIXELS", "40000000");
        vi.stubEnv("THUMBNAIL_TIMEOUT", "30000");
        mockReadFile.mockImplementation(async (file) => {
            if (file === "/sys/fs/cgroup/cpu.stat") {
                return `usage_usec ${resourceUsage.cpu}`;
            }

            if (file === "/sys/fs/cgroup/cpu.max") {
                return "100000 100000";
            }

            if (file === "/sys/fs/cgroup/memory.current") {
                return String(resourceUsage.memory);
            }

            return "1000";
        });
        mockSpawn.mockImplementation(() => {
            const childProcess = new EventEmitter() as MockChildProcess;
            childProcess.stdout = new EventEmitter();
            childProcess.stderr = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
            childProcess.kill = vi.fn();
            childProcesses.push(childProcess);
            return childProcess;
        });
        const { default: DefaultThumbnailService } =
            await import("../../src/services/impl/default-thumbnail-service.js");
        service = new DefaultThumbnailService();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.useRealTimers();
    });

    it("should queue requests until the generator admits them", async () => {
        const first = service.create({ id: "first" });
        const second = service.create({ id: "second" });
        const third = service.create({ id: "third" });
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));
        complete(childProcesses[0]);
        await first;
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(3));
        complete(childProcesses[1]);
        complete(childProcesses[2]);
        await expect(Promise.all([second, third])).resolves.toEqual([
            Buffer.from([0xff, 0xd8]),
            Buffer.from([0xff, 0xd8])
        ]);
    });

    it("reports the batch once all registered files finish", async () => {
        service.registerBatch({
            id: "batch-1",
            userId: "user-1",
            files: [
                { id: "first", size: 100 },
                { id: "second", size: 200 }
            ]
        });
        const first = service.create({ id: "first", batchId: "batch-1" });
        const second = service.create({ id: "second", batchId: "batch-1" });
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));
        resourceUsage.memory = 700;
        await vi.advanceTimersByTimeAsync(1000);
        complete(childProcesses[0]);
        await first;
        expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "thumbnail.batch.completed" }));
        complete(childProcesses[1]);
        await second;
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "thumbnail.batch.completed",
                context: expect.stringMatching(
                    /User: user-1\nBatch: batch-1\nFiles: 2\nGenerated: 2\nFailed: 0\nExpired: 0\nSource size: 300 bytes\nDuration: .*Container peak memory: 70%/s
                )
            })
        );
    });

    it("expires missing files without closing a batch with active work", async () => {
        service.registerBatch({
            id: "batch-1",
            userId: "user-1",
            files: [
                { id: "first", size: 1 },
                { id: "missing", size: 1 }
            ]
        });
        const pending = service.create({ id: "first", batchId: "batch-1" });
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledOnce());
        await vi.advanceTimersByTimeAsync(30000);
        childProcesses[0].emit("close", 1);
        await expect(pending).rejects.toBeDefined();
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "thumbnail.batch.expired",
                context: expect.stringContaining("Files: 2\nGenerated: 0\nFailed: 1\nExpired: 1")
            })
        );
    });

    it.each(["v1", "v2"])("samples resources with unlimited memory on cgroup %s", async (version) => {
        mockReadFile.mockImplementation(async (file: string) => {
            const files: Record<string, string> =
                version === "v2"
                    ? {
                          "/sys/fs/cgroup/cpu.stat": `usage_usec ${resourceUsage.cpu}`,
                          "/sys/fs/cgroup/cpu.max": "100000 100000",
                          "/sys/fs/cgroup/memory.current": "100",
                          "/sys/fs/cgroup/memory.max": "max"
                      }
                    : {
                          "/sys/fs/cgroup/cpuacct/cpuacct.usage": String(resourceUsage.cpu * 1000),
                          "/sys/fs/cgroup/cpu/cpu.cfs_quota_us": "100000",
                          "/sys/fs/cgroup/cpu/cpu.cfs_period_us": "100000",
                          "/sys/fs/cgroup/memory/memory.usage_in_bytes": "100",
                          "/sys/fs/cgroup/memory/memory.limit_in_bytes": "9223372036854771712"
                      };
            if (files[file] !== undefined) {
                return files[file];
            }

            throw new Error("Missing cgroup file");
        });
        service.registerBatch({ id: "batch-1", userId: "user-1", files: [{ id: "first", size: 1 }] });
        const pending = service.create({ id: "first", batchId: "batch-1" });
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledOnce());
        resourceUsage.cpu = 500_000;
        await vi.advanceTimersByTimeAsync(1000);
        complete(childProcesses[0]);
        await pending;
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "thumbnail.batch.completed",
                context: expect.not.stringContaining("Container peak memory: unavailable")
            })
        );
    });

    it("does not overlap resource samples when reading cgroup files is slow", async () => {
        let release = () => {};
        const blocked = new Promise<void>((resolve) => {
            release = resolve;
        });
        mockReadFile.mockImplementation(async (file: string) => {
            await blocked;
            if (file.endsWith("cpu.stat")) {
                return "usage_usec 100";
            }

            if (file.endsWith("cpu.max")) {
                return "100000 100000";
            }

            return "1000";
        });
        service.registerBatch({ id: "batch-1", userId: "user-1", files: [{ id: "first", size: 1 }] });
        const pending = service.create({ id: "first", batchId: "batch-1" });
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledOnce());
        await vi.advanceTimersByTimeAsync(3000);
        expect(mockReadFile).toHaveBeenCalledTimes(4);
        release();
        await vi.advanceTimersByTimeAsync(1);
        complete(childProcesses[0]);
        await pending;
    });

    it("records an unexpected processing failure where it is transformed", async () => {
        const error = new Error("FFmpeg spawn failed");
        mockSpawn.mockImplementation(() => {
            throw error;
        });
        await expect(service.create({ id: "test" })).rejects.toMatchObject({
            code: "THUMBNAIL_GENERATION_FAILED",
            cause: error
        });
        expect(logger.error).toHaveBeenCalledOnce();
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "thumbnail.generation.failed",
                context: "Request: test\nBatch: unknown",
                error
            })
        );
    });

    it("should increase admission when the container has capacity", async () => {
        const first = service.create({ id: "first" });
        const second = service.create({ id: "second" });
        const third = service.create({ id: "third" });
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));
        await vi.advanceTimersByTimeAsync(1000);
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(3));
        complete(childProcesses[0]);
        complete(childProcesses[1]);
        complete(childProcesses[2]);
        await expect(Promise.all([first, second, third])).resolves.toHaveLength(3);
    });

    it.each(["CPU", "memory"])("should reduce admission when the container exceeds its %s target", async (resource) => {
        const first = service.create({ id: "first" });
        const second = service.create({ id: "second" });
        const third = service.create({ id: "third" });
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));
        if (resource === "CPU") {
            resourceUsage.cpu = 900_000;
        } else {
            resourceUsage.memory = 900;
        }

        await vi.advanceTimersByTimeAsync(1000);
        complete(childProcesses[0]);
        await first;
        expect(mockSpawn).toHaveBeenCalledTimes(2);
        complete(childProcesses[1]);
        await second;
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(3));
        complete(childProcesses[2]);
        await third;
    });

    it("should remove queued work when its request is cancelled", async () => {
        const first = service.create({ id: "first" });
        const second = service.create({ id: "second" });
        const controller = new AbortController();
        const third = service.create({ id: "third", signal: controller.signal });
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));
        const rejected = expect(third).rejects.toMatchObject({ status: 499 });
        controller.abort();
        await rejected;
        complete(childProcesses[0]);
        complete(childProcesses[1]);
        await Promise.all([first, second]);
        expect(mockSpawn).toHaveBeenCalledTimes(2);
    });

    it("should terminate active work when its request is cancelled", async () => {
        const controller = new AbortController();
        const generating = service.create({ id: "first", signal: controller.signal });
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledOnce());
        const rejected = expect(generating).rejects.toMatchObject({ status: 499 });
        controller.abort();
        expect(childProcesses[0].kill).toHaveBeenCalledWith("SIGKILL");
        childProcesses[0].emit("close", null);
        await rejected;
    });
});

function complete(childProcess: MockChildProcess): void {
    childProcess.stdout.emit("data", Buffer.from([0xff, 0xd8]));
    childProcess.emit("close", 0);
}
