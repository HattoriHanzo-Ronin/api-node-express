import { afterEach, describe, expect, it, vi } from "vitest";

const validEnvironment = {
    PORT: "3001",
    PUBLIC_URL: "https://router-cpanel.example",
    CHROME_PATH: "/usr/bin/chromium",
    DISPLAY_BASE: "100",
    VNC_PORT_BASE: "5900",
    MAX_ACTIVE_USERS: "10",
    MAX_SESSIONS_PER_USER: "1",
    MAX_VNC_CONNECTIONS_PER_SESSION: "1",
    SESSION_INACTIVITY_TIMEOUT: "600000",
    JWT_ACCESS_TOKEN_EXPIRES_IN: "30min"
};

describe("environment", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it("should load externally supplied session limits", async () => {
        setEnvironment(validEnvironment);
        const { ENV } = await import("../../src/config/environment.js");
        expect(ENV).toMatchObject({
            publicUrl: validEnvironment.PUBLIC_URL,
            chromePath: validEnvironment.CHROME_PATH,
            jwtAccessTokenExpiresIn: validEnvironment.JWT_ACCESS_TOKEN_EXPIRES_IN,
            maxActiveUsers: 10,
            maxSessionsPerUser: 1,
            maxVncConnectionsPerSession: 1,
            sessionInactivityTimeout: 600_000
        });
    });

    it.each(["PUBLIC_URL", "CHROME_PATH", "JWT_ACCESS_TOKEN_EXPIRES_IN"])("should reject a missing %s", async (key) => {
        setEnvironment({ ...validEnvironment, [key]: "" });
        await expect(import("../../src/config/environment.js")).rejects.toMatchObject({
            code: "CONFIGURATION_INVALID"
        });
    });

    it("should reject an invalid token expiration", async () => {
        setEnvironment({ ...validEnvironment, JWT_ACCESS_TOKEN_EXPIRES_IN: "invalid" });
        await expect(import("../../src/config/environment.js")).rejects.toMatchObject({
            code: "CONFIGURATION_INVALID"
        });
    });

    it("should reject a missing per-user session limit", async () => {
        setEnvironment({ ...validEnvironment, MAX_SESSIONS_PER_USER: "" });
        await expect(import("../../src/config/environment.js")).rejects.toMatchObject({
            code: "CONFIGURATION_INVALID"
        });
    });

    it("should reject a missing VNC connection limit", async () => {
        setEnvironment({ ...validEnvironment, MAX_VNC_CONNECTIONS_PER_SESSION: "" });
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
