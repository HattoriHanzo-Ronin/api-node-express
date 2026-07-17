import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthFacade from "../../src/facades/auth-facade.js";
import JWTUtils from "../../src/utils/jwt-utils.js";

vi.mock("../../src/utils/jwt-utils.js", () => ({
    default: { generateAccessToken: vi.fn(), generateRefreshToken: vi.fn(), verifyRefreshToken: vi.fn() }
}));

describe("AuthFacade", () => {
    let usersFacade;
    let refreshTokensService;
    let authFacade;

    beforeEach(() => {
        usersFacade = { authenticate: vi.fn(), getById: vi.fn() };
        refreshTokensService = { getByToken: vi.fn(), create: vi.fn(), delete: vi.fn() };
        authFacade = new AuthFacade({ usersFacade, refreshTokensService });
        JWTUtils.generateAccessToken.mockReturnValue("access-token");
        JWTUtils.generateRefreshToken.mockReturnValue("refresh-token");
        JWTUtils.verifyRefreshToken.mockReturnValue({ id: "1" });
    });

    describe("login", () => {
        it("should authenticate user and create session", async () => {
            usersFacade.authenticate.mockResolvedValue({
                id: "1",
                username: "admin",
                roles: ["ADMIN"],
                scope: ["ADMIN"]
            });
            const result = await authFacade.login({ username: "admin", password: "password" });
            expect(result).toEqual({
                user: { id: "1", username: "admin", roles: ["ADMIN"], scope: ["ADMIN"] },
                accessToken: "access-token",
                refreshToken: "refresh-token"
            });
            expect(refreshTokensService.create).toHaveBeenCalledWith({ userId: "1", token: "refresh-token" });
            expect(usersFacade.authenticate).toHaveBeenCalledWith({ username: "admin", password: "password" });
        });
    });

    describe("refresh", () => {
        it("should refresh an existing session", async () => {
            refreshTokensService.getByToken.mockResolvedValue();
            usersFacade.getById.mockResolvedValue({ id: "1", username: "admin", roles: ["ADMIN"], scope: ["ADMIN"] });
            const result = await authFacade.refresh({ refreshToken: "refresh-token" });
            expect(result).toEqual({
                user: { id: "1", username: "admin", roles: ["ADMIN"], scope: ["ADMIN"] },
                accessToken: "access-token",
                refreshToken: "refresh-token"
            });
            expect(refreshTokensService.getByToken).toHaveBeenCalledWith({ token: "refresh-token" });
            expect(refreshTokensService.delete).toHaveBeenCalledWith({ token: "refresh-token" });
            expect(usersFacade.getById).toHaveBeenCalledWith({ id: "1" });
        });

        it("should revoke invalid refresh tokens", async () => {
            refreshTokensService.getByToken.mockRejectedValue({ message: "Token no válido", code: "INVALID_TOKEN" });
            await expect(authFacade.refresh({ refreshToken: "refresh-token" })).rejects.toThrow("Token no válido");
            expect(refreshTokensService.delete).toHaveBeenCalledWith({ token: "refresh-token" });
        });

        it("should rethrow unexpected errors", async () => {
            refreshTokensService.getByToken.mockRejectedValue(new Error("Database error"));
            await expect(authFacade.refresh({ refreshToken: "refresh-token" })).rejects.toThrow("Database error");
            expect(refreshTokensService.delete).not.toHaveBeenCalled();
        });
    });

    describe("logout", () => {
        it("should revoke an existing session", async () => {
            await authFacade.logout({ refreshToken: "refresh-token" });
            expect(refreshTokensService.delete).toHaveBeenCalledWith({ token: "refresh-token" });
        });
    });
});
