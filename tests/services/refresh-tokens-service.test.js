import { beforeEach, describe, expect, it, vi } from "vitest";
import RefreshTokensService from "../../services/refresh-tokens-service.js";

describe("RefreshTokensService", () => {
    let refreshTokensModel;
    let refreshTokensService;

    beforeEach(() => {
        refreshTokensModel = { getByToken: vi.fn(), insert: vi.fn(), delete: vi.fn() };
        refreshTokensService = new RefreshTokensService({ refreshTokensModel });
    });

    describe("getByToken", () => {
        it("should validate an existing refresh token", async () => {
            refreshTokensModel.getByToken.mockResolvedValue({ token: "refresh-token" });
            await expect(refreshTokensService.getByToken({ token: "refresh-token" })).resolves.toBeUndefined();
            expect(refreshTokensModel.getByToken).toHaveBeenCalledWith({ token: "refresh-token" });
        });

        it("should fail if refresh token does not exist", async () => {
            refreshTokensModel.getByToken.mockResolvedValue(null);
            await expect(refreshTokensService.getByToken({ token: "refresh-token" })).rejects.toThrow(
                "Token no válido"
            );
        });
    });

    describe("create", () => {
        it("should create a refresh token", async () => {
            refreshTokensModel.insert.mockResolvedValue();
            await refreshTokensService.create({ userId: "1", token: "refresh-token" });
            expect(refreshTokensModel.insert).toHaveBeenCalledWith({
                refreshToken: { user_id: "1", token: "refresh-token" }
            });
        });

        it("should fail if user does not exist", async () => {
            refreshTokensModel.insert.mockRejectedValue({ code: "23503" });
            await expect(refreshTokensService.create({ userId: "1", token: "refresh-token" })).rejects.toThrow(
                "El usuario no existe"
            );
        });

        it("should rethrow unexpected errors", async () => {
            refreshTokensModel.insert.mockRejectedValue(new Error("Database error"));
            await expect(refreshTokensService.create({ userId: "1", token: "refresh-token" })).rejects.toThrow(
                "Database error"
            );
        });
    });

    describe("delete", () => {
        it("should delete a refresh token", async () => {
            refreshTokensModel.delete.mockResolvedValue();
            await refreshTokensService.delete({ token: "refresh-token" });
            expect(refreshTokensModel.delete).toHaveBeenCalledWith({ token: "refresh-token" });
        });
    });
});
