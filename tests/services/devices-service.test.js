import { beforeEach, describe, expect, it, vi } from "vitest";
import DevicesService from "../../services/devices-service.js";

vi.mock("../../config/db/postgres-client.js", () => ({
    default: {
        getClient: () => ({
            tx: async (cb) => cb({})
        })
    }
}));

describe("DevicesService", () => {
    let devicesModel;
    let whitelistService;
    let devicesService;
    beforeEach(() => {
        devicesModel = {
            getAll: vi.fn(),
            getById: vi.fn(),
            getAllowedDevices: vi.fn(),
            getNotAllowedDevices: vi.fn(),
            getRoutersByAllowDevice: vi.fn(),
            insert: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        };
        whitelistService = { create: vi.fn(), delete: vi.fn() };
        devicesService = new DevicesService({ devicesModel, whitelistService });
    });

    describe("getAll", () => {
        it("should return device list", async () => {
            const devices = [{ id: "1" }];
            devicesModel.getAll.mockResolvedValue(devices);
            const result = await devicesService.getAll({ intrface: "LAN", type: "CLIENT" });
            expect(result).toEqual(devices);
            expect(devicesModel.getAll).toHaveBeenCalled();
        });
    });

    describe("getById", () => {
        it("should return device by id", async () => {
            const device = { id: "1", name: "Cliente" };
            devicesModel.getById.mockResolvedValue(device);
            const result = await devicesService.getById({ id: "1" });
            expect(result).toEqual(device);
            expect(devicesModel.getById).toHaveBeenCalled();
        });

        it("should fail if device does not exist", async () => {
            devicesModel.getById.mockResolvedValue(null);
            await expect(devicesService.getById({ id: "invalid" })).rejects.toThrow("El dispositivo no existe");
        });
    });

    describe("getAllowDevices", () => {
        it("should return allowed devices", async () => {
            const devices = [{ id: "1" }];
            devicesModel.getAllowedDevices.mockResolvedValue(devices);
            const result = await devicesService.getAllowDevices({ routerId: "1" });
            expect(result).toEqual(devices);
            expect(devicesModel.getAllowedDevices).toHaveBeenCalled();
        });

        it("should return empty array if router does not exist", async () => {
            devicesModel.getAllowedDevices.mockResolvedValue([]);
            const result = await devicesService.getAllowDevices({ routerId: "invalid" });
            expect(result).toEqual([]);
        });
    });

    describe("create", () => {
        it("should create device", async () => {
            const device = { id: "1", name: "Cliente" };
            devicesModel.insert.mockResolvedValue(device);
            const result = await devicesService.create({ device });
            expect(result).toEqual(device);
            expect(devicesModel.insert).toHaveBeenCalled();
        });

        it("should fail if device already exists", async () => {
            const error = new Error("Duplicado");
            error.code = "23505";
            devicesModel.insert.mockRejectedValue(error);
            await expect(devicesService.create({ device: {} })).rejects.toThrow();
        });
    });

    describe("update", () => {
        it("should update device and sync routers", async () => {
            const oldDevice = { id: "1", name: "Old", mac: "AA:BB:CC:DD:EE:01" };
            const updatedDevice = { id: "1", name: "New", mac: "AA:BB:CC:DD:EE:02" };
            const routers = [{ id: "router-1", name: "Router 1" }];
            vi.spyOn(devicesService, "getById").mockResolvedValue(oldDevice);
            devicesModel.update.mockResolvedValue(updatedDevice);
            devicesModel.getRoutersByAllowDevice.mockResolvedValue(routers);
            whitelistService.delete.mockResolvedValue(true);
            whitelistService.create.mockResolvedValue(true);
            const result = await devicesService.update({ data: updatedDevice });
            expect(result.id).toBe("1");
            expect(devicesModel.update).toHaveBeenCalled();
            expect(whitelistService.delete).toHaveBeenCalledTimes(1);
            expect(whitelistService.create).toHaveBeenCalledTimes(1);
        });

        it("should fail if device does not exist", async () => {
            vi.spyOn(devicesService, "getById").mockRejectedValue(new Error("El dispositivo no existe"));
            await expect(devicesService.update({ data: { id: "invalid" } })).rejects.toThrow("El dispositivo no existe");
        });

        it("should rollback routers if sync fails", async () => {
            const oldDevice = { id: "1", name: "Old", mac: "AA:BB:CC:DD:EE:01" };
            const updatedDevice = { id: "1", name: "New", mac: "AA:BB:CC:DD:EE:02" };
            const routers = [
                { id: "router-1", name: "Router 1" },
                { id: "router-2", name: "Router 2" }
            ];
            vi.spyOn(devicesService, "getById").mockResolvedValue(oldDevice);
            devicesModel.update.mockResolvedValue(updatedDevice);
            devicesModel.getRoutersByAllowDevice.mockResolvedValue(routers);
            whitelistService.delete.mockResolvedValue(true);
            whitelistService.create.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error("Router sync failed"));
            await expect(devicesService.update({ data: updatedDevice })).rejects.toThrow("Router sync failed");
            expect(whitelistService.delete).toHaveBeenCalled();
            expect(whitelistService.create).toHaveBeenCalled();
        });
    });

    describe("delete", () => {
        it("should delete device", async () => {
            const device = { id: "1", name: "Cliente" };
            vi.spyOn(devicesService, "getById").mockResolvedValue(device);
            devicesModel.getRoutersByAllowDevice.mockResolvedValue([]);
            devicesModel.delete.mockResolvedValue(device);
            const result = await devicesService.delete({ id: "1" });
            expect(result).toEqual(device);
            expect(devicesModel.delete).toHaveBeenCalled();
        });

        it("should fail if device does not exist", async () => {
            vi.spyOn(devicesService, "getById").mockRejectedValue(new Error("El dispositivo no existe"));
            await expect(devicesService.delete({ id: "invalid" })).rejects.toThrow("El dispositivo no existe");
        });
    });
});
