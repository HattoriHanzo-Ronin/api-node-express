import { describe, expect, it } from "vitest";
import JwtTokenProvider from "../../../src/utils/token-providers/jwt-token-provider.js";

describe("JwtTokenProvider", () => {
    const tokenProvider = new JwtTokenProvider({ secret: "router-cpanel-jwt-secret", expiresIn: "30min" });

    it("should create and verify a router session token", () => {
        const token = tokenProvider.create({ payload: { sid: "session-id" } });
        expect(tokenProvider.verify({ token })).toMatchObject({ sid: "session-id" });
    });

    it("should reject an invalid router session token", () => {
        expect(() => tokenProvider.verify({ token: "invalid" })).toThrow(expect.objectContaining({
            code: "ROUTER_SESSION_INVALID",
            status: 401
        }));
    });
});
