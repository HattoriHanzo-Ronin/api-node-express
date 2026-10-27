import { afterEach, describe, expect, it, vi } from "vitest";

const validEnvironment = {
    PORT: "59998",
    API_URL: "https://api.example",
    THUMBNAIL_GENERATOR_URL: "http://thumbnail-generator:3000",
    ROUTER_CPANEL_SERVICE_URL: "http://router-cpanel-service:3000",
    PORTDB: "5432",
    PORTFTP: "22",
    FTP_MAX_CONNECTIONS: "100",
    FTP_MAX_TRANSFERS: "16",
    FTP_IDLE_TIMEOUT: "900000",
    FTP_SCALE_WAIT: "5000",
    FTP_PROTECTED_USER_IDS: "",
    FTP_INTERNAL_POOL_MIN: "1",
    FTP_INTERNAL_POOL_MAX: "1",
    FTP_READ_POOL_MIN: "1",
    FTP_READ_POOL_MAX: "2",
    FTP_WRITE_POOL_MIN: "1",
    FTP_WRITE_POOL_MAX: "3",
    FTP_MEDIA_SESSION_TIMEOUT: "60000",
    FTP_TRANSFER_SESSION_TIMEOUT: "1800000",
    FTP_MAX_UPLOAD_CHUNK_SIZE: "0",
    FTP_MAX_THUMBNAIL_SIZE: "5242880",
    FTP_DIRECTORY_CHECK_TIMEOUT: "5000",
    MEMORY_CACHE_MAX_SIZE: "2147483648",
    MEMORY_CACHE_MAX_SIZE_PER_OWNER: "419430400",
    MEMORY_CACHE_INACTIVITY_TIMEOUT: "600000",
    DIRECTORY_CACHE_INACTIVITY_TIMEOUT: "600000",
    JWT_ACCESS_TOKEN_EXPIRES_IN: "30min",
    JWT_REFRESH_TOKEN_EXPIRES_IN: "60d"
};

describe("environment", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it("should load externally supplied runtime configuration", async () => {
        setEnvironment(validEnvironment);
        const { ENV } = await import("../../src/config/environment.js");
        expect(ENV).toMatchObject({
            ftpMaxUploadChunkSize: 0,
            ftpWritePoolMax: 3,
            jwtAccessTokenExpiresIn: "30min",
            memoryCacheMaxSize: 2147483648,
            routerCpanelServiceUrl: "http://router-cpanel-service:3000"
        });
    });

    it("should reject missing runtime configuration", async () => {
        setEnvironment({ ...validEnvironment, MEMORY_CACHE_MAX_SIZE: "" });
        await expect(import("../../src/config/environment.js")).rejects.toMatchObject({
            code: "CONFIGURATION_INVALID"
        });
    });

    it("should reject a per-owner cache limit above the global limit", async () => {
        setEnvironment({ ...validEnvironment, MEMORY_CACHE_MAX_SIZE_PER_OWNER: "2147483649" });
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
