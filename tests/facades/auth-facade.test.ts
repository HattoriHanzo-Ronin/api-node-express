import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthFacade from "../../src/facades/impl/default-auth-facade.js";
import type { AuthFacadeDependencies } from "../../src/types/default-auth-facade.js";
import ApiError from "../../src/utils/error/api-error.js";
import { API_ERROR } from "../../src/config/errors.js";

const createUsersFacadeMock = () => ({ authenticate: vi.fn(), getById: vi.fn() });
const createRefreshTokensServiceMock = () => ({ getByToken: vi.fn(), create: vi.fn(), delete: vi.fn() });
const createAccessTokenProviderMock = () => ({ create: vi.fn(() => "access-token"), verify: vi.fn() });
const createRefreshTokenProviderMock = () => ({ create: vi.fn(() => "refresh-token"), verify: vi.fn(() => ({ id: "1" })) });

describe("AuthFacade", () => {
    let usersFacade: ReturnType<typeof createUsersFacadeMock>;
    let refreshTokensService: ReturnType<typeof createRefreshTokensServiceMock>;
    let accessTokenProvider: ReturnType<typeof createAccessTokenProviderMock>;
    let refreshTokenProvider: ReturnType<typeof createRefreshTokenProviderMock>;
    let authFacade: AuthFacade;

    beforeEach(() => {
        usersFacade = createUsersFacadeMock();
        refreshTokensService = createRefreshTokensServiceMock();
        accessTokenProvider = createAccessTokenProviderMock();
        refreshTokenProvider = createRefreshTokenProviderMock();
        authFacade = new AuthFacade({ usersFacade: usersFacade as unknown as AuthFacadeDependencies["usersFacade"], refreshTokensService, accessTokenProvider, refreshTokenProvider });
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
            expect(accessTokenProvider.create).toHaveBeenCalledWith({
                payload: { id: "1", roles: ["ADMIN"], scope: ["ADMIN"] }
            });
            expect(refreshTokenProvider.create).toHaveBeenCalledWith({ payload: { id: "1" } });
        });
    });

    describe("refresh", () => {
        it("should refresh an existing session", async () => {
            refreshTokensService.getByToken.mockResolvedValue(undefined);
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
            expect(accessTokenProvider.create).toHaveBeenCalledWith({
                payload: { id: "1", roles: ["ADMIN"], scope: ["ADMIN"] }
            });
        });

        it("should revoke invalid refresh tokens", async () => {
            refreshTokensService.getByToken.mockRejectedValue(new ApiError({ message: "Token no válido", apiError: API_ERROR.invalidToken }));
            await expect(authFacade.refresh({ refreshToken: "refresh-token" })).rejects.toThrow("Token no válido");
            expect(refreshTokensService.delete).toHaveBeenCalledWith({ token: "refresh-token" });
        });

        it("should rethrow unexpected errors", async () => {
            refreshTokensService.getByToken.mockRejectedValue(new Error("Database error"));
            await expect(authFacade.refresh({ refreshToken: "refresh-token" })).rejects.toThrow("Database error");
            expect(refreshTokensService.delete).not.toHaveBeenCalled();
        });

        it("should not revoke a token for a non-API error with the same code", async () => {
            const error = { code: API_ERROR.invalidToken };
            refreshTokensService.getByToken.mockRejectedValue(error);
            await expect(authFacade.refresh({ refreshToken: "refresh-token" })).rejects.toBe(error);
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
