import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/environment.js", () => ({
    ENV: { jwtAccessTokenExpiresIn: "30min" }
}));
vi.mock("../../src/config/secrets.js", () => ({
    SECRETS: { jwtSecret: "router-cpanel-jwt-secret" }
}));

import JWTUtils from "../../src/utils/jwt-utils.js";

describe("JWTUtils", () => {
    it("should generate and verify a router session token", () => {
        const token = JWTUtils.generateAccessToken({ sid: "session-id" });
        expect(JWTUtils.verifyAccessToken(token)).toMatchObject({ sid: "session-id" });
    });

    it("should reject an invalid router session token", () => {
        expect(() => JWTUtils.verifyAccessToken("invalid")).toThrow(expect.objectContaining({
            code: "ROUTER_SESSION_INVALID",
            status: 401
        }));
    });
});
