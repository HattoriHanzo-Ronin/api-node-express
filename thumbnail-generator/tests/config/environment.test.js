import { afterEach, describe, expect, it, vi } from "vitest";

const validEnvironment = {
    PORT: "3001",
    API_URL: "http://api-node-express:60004",
    THUMBNAIL_INITIAL_CONCURRENCY: "20",
    THUMBNAIL_CPU_TARGET: "80",
    THUMBNAIL_MEMORY_TARGET: "80",
    THUMBNAIL_SCHEDULER_INTERVAL: "1000",
    THUMBNAIL_MAX_OUTPUT_SIZE: "5242880",
    THUMBNAIL_MAX_PIXELS: "40000000",
    THUMBNAIL_TIMEOUT: "30000"
};

describe("environment", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it("should load externally supplied thumbnail limits", async () => {
        setEnvironment(validEnvironment);
        const { ENV } = await import("../../src/config/environment.js");
        expect(ENV).toMatchObject({
            thumbnailInitialConcurrency: 20,
            thumbnailCpuTarget: 80,
            thumbnailMemoryTarget: 80,
            thumbnailSchedulerInterval: 1_000,
            thumbnailMaxOutputSize: 5_242_880,
            thumbnailMaxPixels: 40_000_000,
            thumbnailTimeout: 30_000
        });
    });

    it("should reject an invalid thumbnail configuration", async () => {
        setEnvironment({ ...validEnvironment, THUMBNAIL_CPU_TARGET: "101" });
        await expect(import("../../src/config/environment.js")).rejects.toMatchObject({
            code: "CONFIGURATION_INVALID"
        });
    });
});

function setEnvironment(environment) {
    for (const [key, value] of Object.entries(environment)) {
        vi.stubEnv(key, value);
    }
}
