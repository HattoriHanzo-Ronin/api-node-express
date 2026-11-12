import { afterEach, describe, expect, it, vi } from "vitest";

const validEnvironment = {
    PORT: "3001",
    LOG_LEVEL: "info",
    LOG_DIRECTORY: "/tmp/thumbnail-test-logs",
    LOG_RETENTION_WEEKS: "8",
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
            apiUrl: validEnvironment.API_URL,
            thumbnailInitialConcurrency: 20,
            thumbnailCpuTarget: 80,
            thumbnailMemoryTarget: 80,
            thumbnailSchedulerInterval: 1_000,
            thumbnailMaxOutputSize: 5_242_880,
            thumbnailMaxPixels: 40_000_000,
            thumbnailTimeout: 30_000
        });
    });

    it("should reject a missing API URL", async () => {
        setEnvironment({ ...validEnvironment, API_URL: "" });
        await expect(import("../../src/config/environment.js")).rejects.toMatchObject({
            code: "CONFIGURATION_INVALID"
        });
    });

    it("should reject an invalid thumbnail configuration", async () => {
        setEnvironment({ ...validEnvironment, THUMBNAIL_CPU_TARGET: "101" });
        await expect(import("../../src/config/environment.js")).rejects.toMatchObject({
            code: "CONFIGURATION_INVALID"
        });
    });

    it("should reject invalid logging configuration", async () => {
        setEnvironment({ ...validEnvironment, LOG_LEVEL: "verbose" });
        await expect(import("../../src/config/environment.js")).rejects.toMatchObject({
            code: "CONFIGURATION_INVALID"
        });
    });

    it.each(["LOG_LEVEL", "LOG_DIRECTORY", "LOG_RETENTION_WEEKS"])("should require %s", async (name) => {
        setEnvironment(validEnvironment);
        vi.stubEnv(name, undefined);
        await expect(import("../../src/config/environment.js")).rejects.toMatchObject({
            code: "CONFIGURATION_INVALID"
        });
    });
});

function setEnvironment(environment: Record<string, string>): void {
    for (const [key, value] of Object.entries(environment)) {
        vi.stubEnv(key, value);
    }
}
