import { beforeEach, describe, expect, it, vi } from "vitest";
import RouterResolver from "../../device-routers/router-resolver.js";
import WhitelistService from "../../services/whitelist-service.js";

vi.mock("../../config/db/postgres-client.js", () => ({
    default: { getClient: () => ({ tx: async (cb) => cb({}) }) }
}));

vi.mock("../../device-routers/router-resolver.js", () => ({
    default: { getRouter: vi.fn() }
}));

describe("WhitelistService", () => {
    let whitelistModel;
    let whitelistService;
    let routerImpl;
    const router = { id: "router-1", name: "Router", mac_filter: true };
    const allowDevice = { id: "device-1", name: "Cliente", mac: "AA:BB:CC:DD:EE:01" };

    beforeEach(() => {
        whitelistModel = { getKeys: vi.fn(), insert: vi.fn(), delete: vi.fn() };
        routerImpl = { getKey: vi.fn(), getCapabilities: vi.fn(), addAllow: vi.fn(), deleteAllow: vi.fn() };
        RouterResolver.getRouter.mockReturnValue(routerImpl);
        whitelistService = new WhitelistService({ whitelistModel });
    });

    describe("insert", () => {
        it("should insert whitelist entry", async () => {
            whitelistModel.getKeys.mockResolvedValue([]);
            routerImpl.getKey.mockReturnValue("white_list_1");
            whitelistModel.insert.mockResolvedValue({ router_id: router.id, allow_device_id: allowDevice.id });
            routerImpl.getCapabilities.mockReturnValue({ addAllow: true });
            routerImpl.addAllow.mockResolvedValue(true);
            const result = await whitelistService.create({ router, allowDevice });
            expect(result).toEqual({ router_id: router.id, allow_device_id: allowDevice.id });
            expect(whitelistModel.insert).toHaveBeenCalled();
            expect(routerImpl.addAllow).toHaveBeenCalled();
        });

        it("should insert whitelist entry without router sync", async () => {
            whitelistModel.getKeys.mockResolvedValue([]);
            routerImpl.getKey.mockReturnValue("white_list_1");
            whitelistModel.insert.mockResolvedValue({ router_id: router.id, allow_device_id: allowDevice.id });
            routerImpl.getCapabilities.mockReturnValue({ addAllow: false });
            const result = await whitelistService.create({ router, allowDevice });
            expect(result).toBeDefined();
            expect(routerImpl.addAllow).not.toHaveBeenCalled();
        });

        it("should fail if router does not exist", async () => {
            const error = new Error();
            error.code = "23503";
            error.constraint = "fk_whitelist_router";
            whitelistModel.getKeys.mockResolvedValue([]);
            routerImpl.getKey.mockReturnValue("white_list_1");
            whitelistModel.insert.mockRejectedValue(error);
            await expect(whitelistService.create({ router, allowDevice })).rejects.toThrow("El router no existe");
        });

        it("should fail if allow device does not exist", async () => {
            const error = new Error();
            error.code = "23503";
            error.constraint = "fk_whitelist_allow_device";
            whitelistModel.getKeys.mockResolvedValue([]);
            routerImpl.getKey.mockReturnValue("white_list_1");
            whitelistModel.insert.mockRejectedValue(error);
            await expect(whitelistService.create({ router, allowDevice })).rejects.toThrow("El dispositivo no existe");
        });

        it("should fail if device is already authorized", async () => {
            const error = new Error();
            error.code = "23505";
            whitelistModel.getKeys.mockResolvedValue([]);
            routerImpl.getKey.mockReturnValue("white_list_1");
            whitelistModel.insert.mockRejectedValue(error);
            await expect(whitelistService.create({ router, allowDevice })).rejects.toThrow(
                "El dispositivo ya se encuentra autorizado"
            );
        });

        it("should fail if router insertion fails", async () => {
            whitelistModel.getKeys.mockResolvedValue([]);
            routerImpl.getKey.mockReturnValue("white_list_1");
            whitelistModel.insert.mockResolvedValue({ router_id: router.id, allow_device_id: allowDevice.id });
            routerImpl.getCapabilities.mockReturnValue({ addAllow: true });
            routerImpl.addAllow.mockResolvedValue(false);
            await expect(whitelistService.create({ router, allowDevice })).rejects.toThrow(
                "Error al insertar el dispositivo en el router"
            );
        });

        it("should fail if router implementation does not exist", async () => {
            RouterResolver.getRouter.mockReturnValue(null);
            await expect(whitelistService.create({ router, allowDevice })).rejects.toThrow(
                "Router no tiene implementación disponible"
            );
        });
    });

    describe("delete", () => {
        it("should delete whitelist entry", async () => {
            whitelistModel.delete.mockResolvedValue({
                key: "white_list_1",
                router_id: router.id,
                allow_device_id: allowDevice.id
            });
            routerImpl.getCapabilities.mockReturnValue({ deleteAllow: true });
            routerImpl.deleteAllow.mockResolvedValue(true);
            const result = await whitelistService.delete({ router, allowDevice });
            expect(result).toEqual({ router_id: router.id, allow_device_id: allowDevice.id });
            expect(whitelistModel.delete).toHaveBeenCalled();
            expect(routerImpl.deleteAllow).toHaveBeenCalled();
        });

        it("should delete whitelist entry without router sync", async () => {
            whitelistModel.delete.mockResolvedValue({ key: "white_list_1" });
            routerImpl.getCapabilities.mockReturnValue({ deleteAllow: false });
            const result = await whitelistService.delete({ router, allowDevice });
            expect(result).toBeDefined();
            expect(routerImpl.deleteAllow).not.toHaveBeenCalled();
        });

        it("should fail if whitelist entry does not exist", async () => {
            whitelistModel.delete.mockResolvedValue(null);
            await expect(whitelistService.delete({ router, allowDevice })).rejects.toThrow(
                "El dispositivo no se encuentra autorizado"
            );
        });

        it("should fail if router deletion fails", async () => {
            whitelistModel.delete.mockResolvedValue({ key: "white_list_1" });
            routerImpl.getCapabilities.mockReturnValue({
                deleteAllow: true
            });
            routerImpl.deleteAllow.mockResolvedValue(false);
            await expect(whitelistService.delete({ router, allowDevice })).rejects.toThrow(
                "Error al eliminar el dispositivo del router"
            );
        });

        it("should fail if router implementation does not exist", async () => {
            RouterResolver.getRouter.mockReturnValue(null);
            await expect(whitelistService.delete({ router, allowDevice })).rejects.toThrow(
                "Router no tiene implementación disponible"
            );
        });
    });
});
