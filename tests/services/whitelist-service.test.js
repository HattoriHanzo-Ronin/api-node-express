import { beforeEach, describe, expect, it, vi } from "vitest";
import WhitelistService from "../../src/services/whitelist-service.js";

describe("WhitelistService", () => {
    let whitelistModel;
    let whitelistService;

    beforeEach(() => {
        whitelistModel = { getKeys: vi.fn(), insert: vi.fn(), delete: vi.fn() };
        whitelistService = new WhitelistService({ whitelistModel });
    });

    describe("getKey", () => {
        it("should generate a key from current whitelist keys", async () => {
            whitelistModel.getKeys.mockResolvedValue([{ key: "white_list_1" }]);
            const generateKey = vi.fn().mockReturnValue("white_list_2");
            await expect(whitelistService.getKey({ routerId: "router-1", generateKey })).resolves.toBe("white_list_2");
            expect(generateKey).toHaveBeenCalledWith([{ key: "white_list_1" }]);
        });
    });

    describe("create", () => {
        it("should insert whitelist entry", async () => {
            const whitelist = { router_id: "router-1", connection_mac: "AA:BB:CC:DD:EE:01", key: "white_list_1" };
            whitelistModel.insert.mockResolvedValue();
            await expect(whitelistService.create({ clientTx: {}, whitelist })).resolves.toBeUndefined();
            expect(whitelistModel.insert).toHaveBeenCalledWith({ clientTx: {}, whitelist });
        });

        it("should fail if device is already authorized", async () => {
            const error = new Error("duplicate");
            error.code = "23505";
            error.constraint = "whitelist_pk";
            whitelistModel.insert.mockRejectedValue(error);
            await expect(whitelistService.create({ clientTx: {}, whitelist: {} })).rejects.toThrow(
                "El dispositivo ya se encuentra autorizado"
            );
        });

        it("should fail if router whitelist key is duplicated", async () => {
            const error = new Error("duplicate");
            error.code = "23505";
            error.constraint = "whitelist_router_id_key_unique";
            whitelistModel.insert.mockRejectedValue(error);
            await expect(whitelistService.create({ clientTx: {}, whitelist: {} })).rejects.toMatchObject({
                code: "WHITELIST_KEY_GENERATION_FAILED"
            });
        });
    });

    describe("delete", () => {
        it("should delete whitelist entry", async () => {
            const data = { clientTx: {}, routerId: "router-1", mac: "AA:BB:CC:DD:EE:01" };
            whitelistModel.delete.mockResolvedValue({ key: "white_list_1" });
            await expect(whitelistService.delete(data)).resolves.toEqual({ key: "white_list_1" });
            expect(whitelistModel.delete).toHaveBeenCalledWith(data);
        });

        it("should fail if whitelist entry does not exist", async () => {
            const data = { clientTx: {}, routerId: "router-1", mac: "AA:BB:CC:DD:EE:01" };
            whitelistModel.delete.mockResolvedValue(null);
            await expect(whitelistService.delete(data)).rejects.toThrow("El dispositivo no se encuentra autorizado");
        });
    });
});
