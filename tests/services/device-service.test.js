import { beforeEach, describe, expect, it, vi } from "vitest";
import DeviceService from "../../services/device-service.js";

vi.mock("../../config/db/postgres-client.js", () => ({
    default: {
        getClient: () => ({
            tx: async (cb) => cb({})
        })
    }
}));

describe("DeviceService", () => {
    let deviceModel;
    let whitelistService;
    let deviceService;
    beforeEach(() => {
        deviceModel = {
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
        deviceService = new DeviceService({ deviceModel, whitelistService });
    });

    describe("getAll", () => {
        it("should return device list", async () => {
            const devices = [{ id: "1" }];
            deviceModel.getAll.mockResolvedValue(devices);
            const result = await deviceService.getAll({ intrface: "LAN", type: "CLIENT" });
            expect(result).toEqual(devices);
            expect(deviceModel.getAll).toHaveBeenCalled();
        });
    });

    describe("getById", () => {
        it("should return device by id", async () => {
            const device = { id: "1", name: "Cliente" };
            deviceModel.getById.mockResolvedValue(device);
            const result = await deviceService.getById({ id: "1" });
            expect(result).toEqual(device);
            expect(deviceModel.getById).toHaveBeenCalled();
        });

        it("should fail if device does not exist", async () => {
            deviceModel.getById.mockResolvedValue(null);
            await expect(deviceService.getById({ id: "invalid" })).rejects.toThrow("El dispositivo no existe");
        });
    });

    describe("getAllowDevices", () => {
        it("should return allowed devices", async () => {
            const devices = [{ id: "1" }];
            deviceModel.getAllowedDevices.mockResolvedValue(devices);
            const result = await deviceService.getAllowDevices({ routerId: "1" });
            expect(result).toEqual(devices);
            expect(deviceModel.getAllowedDevices).toHaveBeenCalled();
        });

        it("should return empty array if router does not exist", async () => {
            deviceModel.getAllowedDevices.mockResolvedValue([]);
            const result = await deviceService.getAllowDevices({ routerId: "invalid" });
            expect(result).toEqual([]);
        });
    });

    describe("create", () => {
        it("should create device", async () => {
            const device = { id: "1", name: "Cliente" };
            deviceModel.insert.mockResolvedValue(device);
            const result = await deviceService.create({ device });
            expect(result).toEqual(device);
            expect(deviceModel.insert).toHaveBeenCalled();
        });

        it("should fail if device already exists", async () => {
            const error = new Error("Duplicado");
            error.code = "23505";
            deviceModel.insert.mockRejectedValue(error);
            await expect(deviceService.create({ device: {} })).rejects.toThrow();
        });
    });

    describe("update", () => {
        it("should update device and sync routers", async () => {
            const oldDevice = { id: "1", name: "Old", mac: "AA:BB:CC:DD:EE:01" };
            const updatedDevice = { id: "1", name: "New", mac: "AA:BB:CC:DD:EE:02" };
            const routers = [{ id: "router-1", name: "Router 1" }];
            vi.spyOn(deviceService, "getById").mockResolvedValue(oldDevice);
            deviceModel.update.mockResolvedValue(updatedDevice);
            deviceModel.getRoutersByAllowDevice.mockResolvedValue(routers);
            whitelistService.delete.mockResolvedValue(true);
            whitelistService.create.mockResolvedValue(true);
            const result = await deviceService.update({ data: updatedDevice });
            expect(result.id).toBe("1");
            expect(deviceModel.update).toHaveBeenCalled();
            expect(whitelistService.delete).toHaveBeenCalledTimes(1);
            expect(whitelistService.create).toHaveBeenCalledTimes(1);
        });

        it("should fail if device does not exist", async () => {
            vi.spyOn(deviceService, "getById").mockRejectedValue(new Error("El dispositivo no existe"));
            await expect(deviceService.update({ data: { id: "invalid" } })).rejects.toThrow("El dispositivo no existe");
        });

        it("should rollback routers if sync fails", async () => {
            const oldDevice = { id: "1", name: "Old", mac: "AA:BB:CC:DD:EE:01" };
            const updatedDevice = { id: "1", name: "New", mac: "AA:BB:CC:DD:EE:02" };
            const routers = [
                { id: "router-1", name: "Router 1" },
                { id: "router-2", name: "Router 2" }
            ];
            vi.spyOn(deviceService, "getById").mockResolvedValue(oldDevice);
            deviceModel.update.mockResolvedValue(updatedDevice);
            deviceModel.getRoutersByAllowDevice.mockResolvedValue(routers);
            whitelistService.delete.mockResolvedValue(true);
            whitelistService.create.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error("Router sync failed"));
            await expect(deviceService.update({ data: updatedDevice })).rejects.toThrow("Router sync failed");
            expect(whitelistService.delete).toHaveBeenCalled();
            expect(whitelistService.create).toHaveBeenCalled();
        });
    });

    describe("delete", () => {
        it("should delete device", async () => {
            const device = { id: "1", name: "Cliente" };
            vi.spyOn(deviceService, "getById").mockResolvedValue(device);
            deviceModel.getRoutersByAllowDevice.mockResolvedValue([]);
            deviceModel.delete.mockResolvedValue(device);
            const result = await deviceService.delete({ id: "1" });
            expect(result).toEqual(device);
            expect(deviceModel.delete).toHaveBeenCalled();
        });

        it("should fail if device does not exist", async () => {
            vi.spyOn(deviceService, "getById").mockRejectedValue(new Error("El dispositivo no existe"));
            await expect(deviceService.delete({ id: "invalid" })).rejects.toThrow("El dispositivo no existe");
        });
    });
});
