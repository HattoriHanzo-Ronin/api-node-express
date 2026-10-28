import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import JwtTokenProvider from "../../../src/utils/token-providers/jwt-token-provider.js";

vi.mock("jsonwebtoken", () => ({
    default: {
        sign: vi.fn(),
        verify: vi.fn(),
        JsonWebTokenError: class JsonWebTokenError extends Error {}
    }
}));

describe("JwtTokenProvider", () => {
    let tokenProvider;

    beforeEach(() => {
        vi.clearAllMocks();
        tokenProvider = new JwtTokenProvider({ secret: "secret", expiresIn: "30min" });
        jwt.sign.mockReturnValue("token");
    });

    it("should create tokens with its configured expiration", () => {
        const payload = { id: "user-id" };

        expect(tokenProvider.create({ payload })).toBe("token");
        expect(jwt.sign).toHaveBeenCalledWith(payload, "secret", { expiresIn: "30min" });
    });

    it("should verify and decode tokens", () => {
        const payload = { id: "user-id" };
        jwt.verify.mockReturnValue(payload);

        expect(tokenProvider.verify({ token: "token" })).toBe(payload);
        expect(jwt.verify).toHaveBeenCalledWith("token", "secret");
    });

    it("should translate invalid tokens", () => {
        jwt.verify.mockImplementation(() => {
            throw new jwt.JsonWebTokenError();
        });

        expect(() => tokenProvider.verify({ token: "token" })).toThrow("Token no válido");
    });
});
