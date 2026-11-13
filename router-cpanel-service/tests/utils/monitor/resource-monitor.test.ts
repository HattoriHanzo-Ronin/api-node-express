import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readFile: vi.fn(), info: vi.fn(), warn: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("../../../src/utils/logger/logger.js", () => ({
    default: { getLogger: () => ({ info: mocks.info, warn: mocks.warn }) }
}));

import ResourceMonitor from "../../../src/utils/monitor/resource-monitor.js";

describe("ResourceMonitor", () => {
    let usage: number;
    let memory: number;
    let sessions: number;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 0, 1, 22, 59, 40));
        usage = 0;
        memory = 200;
        sessions = 1;
        mocks.readFile.mockImplementation(async (file: string) => {
            if (file.endsWith("cpu.stat")) {
                return `usage_usec ${usage}`;
            }

            if (file.endsWith("cpu.max")) {
                return "100000 100000";
            }

            if (file.endsWith("memory.current")) {
                return `${memory}`;
            }

            if (file.endsWith("memory.max")) {
                return "1000";
            }
            throw new Error("Unknown file");
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it("reports separate container peaks with the sessions active at each peak", async () => {
        const monitor = new ResourceMonitor({ reportHour: 23, activeSessions: () => sessions });
        monitor.start();
        await vi.advanceTimersByTimeAsync(1);
        usage = 500_000;
        memory = 800;
        sessions = 2;
        await vi.advanceTimersByTimeAsync(10_000);
        usage = 700_000;
        memory = 400;
        sessions = 3;
        await vi.advanceTimersByTimeAsync(10_000);
        expect(mocks.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "router.resources.peak",
                context: expect.stringMatching(
                    /Reason: scheduled, CPU peak: 50%, sessions: 2, at: .*, CPU limit reached: false, memory peak: 80%, sessions: 2, at:/
                )
            })
        );
        await monitor.stop();
    });

    it("reports available measurements when the service stops before the scheduled hour", async () => {
        const monitor = new ResourceMonitor({ reportHour: 23, activeSessions: () => sessions });
        monitor.start();
        await vi.advanceTimersByTimeAsync(1);
        await monitor.stop();
        expect(mocks.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "router.resources.peak",
                context: expect.stringContaining("Reason: shutdown")
            })
        );
    });

    it("ignores peaks sampled without active sessions", async () => {
        sessions = 0;
        memory = 950;
        const monitor = new ResourceMonitor({ reportHour: 23, activeSessions: () => sessions });
        monitor.start();
        await vi.advanceTimersByTimeAsync(1);
        usage = 900_000;
        await vi.advanceTimersByTimeAsync(10_000);
        sessions = 1;
        memory = 300;
        usage = 1_000_000;
        await vi.advanceTimersByTimeAsync(10_000);
        expect(mocks.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "router.resources.peak",
                context: expect.stringMatching(/CPU peak: 10%, sessions: 1,.*memory peak: 30%, sessions: 1/)
            })
        );
        await monitor.stop();
    });

    it("does not report a peak if there were no active sessions", async () => {
        sessions = 0;
        const monitor = new ResourceMonitor({ reportHour: 23, activeSessions: () => sessions });
        monitor.start();
        await vi.advanceTimersByTimeAsync(20_001);
        await monitor.stop();
        expect(mocks.info).not.toHaveBeenCalled();
    });

    it("stops reading resources after the last session closes and resumes for a new session", async () => {
        const monitor = new ResourceMonitor({ reportHour: 23, activeSessions: () => sessions });
        monitor.start();
        await vi.advanceTimersByTimeAsync(1001);
        sessions = 0;
        monitor.pause();
        const reads = mocks.readFile.mock.calls.length;
        await vi.advanceTimersByTimeAsync(5000);
        expect(mocks.readFile).toHaveBeenCalledTimes(reads);
        sessions = 1;
        monitor.start();
        await vi.advanceTimersByTimeAsync(1);
        expect(mocks.readFile.mock.calls.length).toBeGreaterThan(reads);
        await monitor.stop();
    });
});
