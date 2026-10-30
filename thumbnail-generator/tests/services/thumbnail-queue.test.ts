import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockChildProcess, ResourceUsage, ThumbnailService } from "../types/thumbnail-service.js";

const { childProcesses, mockReadFile, mockSpawn } = vi.hoisted(() => ({
    childProcesses: [] as MockChildProcess[],
    mockReadFile: vi.fn(),
    mockSpawn: vi.fn()
}));

vi.mock("node:child_process", () => ({ spawn: mockSpawn }));
vi.mock("node:fs/promises", () => ({ readFile: mockReadFile }));

describe("ThumbnailService queue", () => {
    let resourceUsage: ResourceUsage;
    let service: ThumbnailService;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.useFakeTimers();
        childProcesses.length = 0;
        resourceUsage = { cpu: 0, memory: 100 };
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
        ({ DefaultThumbnailService: service } = await import("../../src/services/impl/default-thumbnail-service.js"));
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
        await expect(Promise.all([second, third])).resolves.toEqual([Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0xd8])]);
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
