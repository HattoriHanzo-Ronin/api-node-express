import { afterEach, describe, expect, it, vi } from "vitest";

const validEnvironment = {
    PORT: "3001",
    PUBLIC_URL: "https://router-cpanel.example",
    CHROME_PATH: "/usr/bin/chromium",
    DISPLAY_BASE: "100",
    VNC_PORT_BASE: "5900",
    MAX_ACTIVE_USERS: "10",
    MAX_SESSIONS_PER_USER: "1",
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
            maxActiveUsers: 10,
            maxSessionsPerUser: 1,
            sessionInactivityTimeout: 600_000
        });
    });

    it("should reject a missing per-user session limit", async () => {
        setEnvironment({ ...validEnvironment, MAX_SESSIONS_PER_USER: "" });
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
