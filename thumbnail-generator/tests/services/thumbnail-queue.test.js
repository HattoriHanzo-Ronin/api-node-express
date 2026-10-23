import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { childProcesses, mockSpawn } = vi.hoisted(() => ({ childProcesses: [], mockSpawn: vi.fn() }));

vi.mock("node:child_process", () => ({ spawn: mockSpawn }));

describe("ThumbnailService queue", () => {
    let service;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        childProcesses.length = 0;
        vi.stubEnv("PORT", "3000");
        vi.stubEnv("API_URL", "http://127.0.0.1:59998");
        vi.stubEnv("THUMBNAIL_GENERATOR_URL", "http://thumbnail-generator:3000");
        vi.stubEnv("THUMBNAIL_INITIAL_CONCURRENCY", "1");
        vi.stubEnv("THUMBNAIL_CPU_TARGET", "80");
        vi.stubEnv("THUMBNAIL_MEMORY_TARGET", "80");
        vi.stubEnv("THUMBNAIL_SCHEDULER_INTERVAL", "1000");
        mockSpawn.mockImplementation(() => {
            const childProcess = new EventEmitter();
            childProcess.stdout = new EventEmitter();
            childProcess.stderr = new EventEmitter();
            childProcess.stderr.setEncoding = vi.fn();
            childProcess.kill = vi.fn();
            childProcesses.push(childProcess);
            return childProcess;
        });
        ({ default: service } = await import("../../src/services/thumbnail-service.js"));
    });

    afterEach(() => vi.unstubAllEnvs());

    it("should queue requests until the generator admits them", async () => {
        const first = service.create({ id: "first" });
        const second = service.create({ id: "second" });
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledOnce());
        complete(childProcesses[0]);
        await first;
        await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2));
        complete(childProcesses[1]);
        await expect(second).resolves.toEqual(Buffer.from([0xff, 0xd8]));
    });
});

function complete(childProcess) {
    childProcess.stdout.emit("data", Buffer.from([0xff, 0xd8]));
    childProcess.emit("close", 0);
}
