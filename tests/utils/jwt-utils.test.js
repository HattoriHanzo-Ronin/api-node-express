import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import JWTUtils from "../../src/utils/jwt-utils.js";

vi.mock("jsonwebtoken", () => ({
    default: {
        sign: vi.fn(),
        verify: vi.fn(),
        JsonWebTokenError: class JsonWebTokenError extends Error {}
    }
}));

vi.mock("../../src/config/secrets.js", () => ({
    SECRETS: { jwtSecret: "access-secret", refreshJwtSecret: "refresh-secret" }
}));

vi.mock("../../src/config/environment.js", () => ({
    ENV: { jwtAccessTokenExpiresIn: "30min", jwtRefreshTokenExpiresIn: "60d" }
}));

describe("JWTUtils", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        jwt.sign.mockReturnValue("token");
    });

    it("should generate access tokens with the configured expiration", () => {
        const payload = { id: "user-id" };
        expect(JWTUtils.generateAccessToken(payload)).toBe("token");
        expect(jwt.sign).toHaveBeenCalledWith(payload, "access-secret", { expiresIn: "30min" });
    });

    it("should generate refresh tokens with the configured expiration", () => {
        const payload = { id: "user-id" };
        expect(JWTUtils.generateRefreshToken(payload)).toBe("token");
        expect(jwt.sign).toHaveBeenCalledWith(payload, "refresh-secret", { expiresIn: "60d" });
    });
});
