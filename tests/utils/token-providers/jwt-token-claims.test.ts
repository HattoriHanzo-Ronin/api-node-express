import { describe, expect, it } from "vitest";
import JwtProvider from "../../../src/utils/token-providers/impl/jwt-token-provider.js";
import type { AuthAccessTokenPayload, VerifiedAccessToken } from "../../../src/types/auth/auth-facade.js";
import { USER_ROLE } from "../../../src/config/constants.js";

describe("JWT access token claims", () => {
    it("returns the expiration added when signing the token", () => {
        const provider = new JwtProvider<AuthAccessTokenPayload, VerifiedAccessToken>({
            secret: "test-secret",
            expiresIn: "30min"
        });
        const payload = { id: "user-id", roles: [USER_ROLE.net] };
        const token = provider.create({ payload });
        const verified = provider.verify({ token });
        expect(verified).toMatchObject(payload);
        expect(verified.iat).toBeLessThan(verified.exp);
        expect(verified.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
});
