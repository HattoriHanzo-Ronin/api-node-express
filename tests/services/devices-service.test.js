import { beforeEach, describe, expect, it, vi } from "vitest";
import DevicesService from "../../services/devices-service.js";

describe("DevicesService", () => {
    let devicesModel;
    let devicesService;

    beforeEach(() => {
        devicesModel = {
            getAll: vi.fn(),
            getById: vi.fn(),
            getAllowedDevices: vi.fn(),
            getNotAllowedDevices: vi.fn(),
            getRoutersByAllowedDevice: vi.fn(),
            insert: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        };
        devicesService = new DevicesService({ devicesModel });
    });

    describe("getAll", () => {
        it("should return device list", async () => {
            const devices = [{ id: "device-1" }];
            devicesModel.getAll.mockResolvedValue(devices);
            await expect(devicesService.getAll()).resolves.toEqual(devices);
            expect(devicesModel.getAll).toHaveBeenCalled();
        });
    });

    describe("getById", () => {
        it("should return device by id", async () => {
            const device = { id: "device-1", name: "Desktop" };
            devicesModel.getById.mockResolvedValue(device);
            await expect(devicesService.getById({ id: "device-1" })).resolves.toEqual(device);
            expect(devicesModel.getById).toHaveBeenCalledWith({ id: "device-1" });
        });

        it("should fail if device does not exist", async () => {
            devicesModel.getById.mockResolvedValue(null);
            await expect(devicesService.getById({ id: "missing" })).rejects.toThrow("El dispositivo no existe");
        });
    });

    describe("getAllowedDevices", () => {
        it("should return allowed devices source grouped into devices and connections", async () => {
            devicesModel.getAllowedDevices.mockResolvedValue([
                { id: "device-1", name: "Desktop", type: "CLIENT", ctype: "LAN", mac: "AA:BB:CC:DD:EE:01" }
            ]);
            await expect(devicesService.getAllowedDevices({ routerId: "router-1" })).resolves.toEqual({
                devices: [{ id: "device-1", name: "Desktop", type: "CLIENT" }],
                connections: [{ device_id: "device-1", ctype: "LAN", mac: "AA:BB:CC:DD:EE:01" }]
            });
            expect(devicesModel.getAllowedDevices).toHaveBeenCalledWith({ routerId: "router-1" });
        });
    });

    describe("getNotAllowedDevices", () => {
        it("should return not allowed devices source grouped into devices and connections", async () => {
            devicesModel.getNotAllowedDevices.mockResolvedValue([
                { id: "device-1", name: "Desktop", type: "CLIENT", ctype: "WIFI", mac: "AA:BB:CC:DD:EE:02" }
            ]);
            await expect(devicesService.getNotAllowedDevices({ routerId: "router-1" })).resolves.toEqual({
                devices: [{ id: "device-1", name: "Desktop", type: "CLIENT" }],
                connections: [{ device_id: "device-1", ctype: "WIFI", mac: "AA:BB:CC:DD:EE:02" }]
            });
        });
    });

    describe("getRoutersByAllowedDevice", () => {
        it("should group router rows by router", async () => {
            devicesModel.getRoutersByAllowedDevice.mockResolvedValue([
                {
                    id: "router-1",
                    name: "Router",
                    model: "TP-Link Archer AX53",
                    ctype: "LAN",
                    mac: "AA:BB:CC:DD:EE:01",
                    key: "white_list_1"
                },
                {
                    id: "router-1",
                    name: "Router",
                    model: "TP-Link Archer AX53",
                    ctype: "WIFI",
                    mac: "AA:BB:CC:DD:EE:02",
                    key: "white_list_2"
                }
            ]);
            await expect(devicesService.getRoutersByAllowedDevice({ allowedDeviceId: "device-1" })).resolves.toEqual([
                {
                    id: "router-1",
                    name: "Router",
                    model: "TP-Link Archer AX53",
                    connections: [
                        { ctype: "LAN", mac: "AA:BB:CC:DD:EE:01", key: "white_list_1" },
                        { ctype: "WIFI", mac: "AA:BB:CC:DD:EE:02", key: "white_list_2" }
                    ]
                }
            ]);
        });
    });

    describe("create", () => {
        it("should create device", async () => {
            const device = { id: "device-1", name: "Desktop" };
            devicesModel.insert.mockResolvedValue(device);
            await expect(devicesService.create({ clientTx: {}, device })).resolves.toEqual(device);
            expect(devicesModel.insert).toHaveBeenCalledWith({ clientTx: {}, device });
        });

        it("should translate duplicated device name errors", async () => {
            const error = new Error("duplicate");
            error.code = "23505";
            error.constraint = "devices_name_unique";
            devicesModel.insert.mockRejectedValue(error);
            await expect(devicesService.create({ clientTx: {}, device: {} })).rejects.toMatchObject({
                code: "DEVICE_NAME_ALREADY_EXISTS"
            });
        });
    });

    describe("update", () => {
        it("should update and validate the returned device", async () => {
            const id = "550e8400-e29b-41d4-a716-446655440000";
            const data = { name: "Desktop Updated" };
            const device = { id, name: "Desktop Updated", type: "CLIENT" };
            devicesModel.update.mockResolvedValue(device);
            await expect(devicesService.update({ clientTx: {}, id, data })).resolves.toMatchObject(device);
            expect(devicesModel.update).toHaveBeenCalledWith({ clientTx: {}, id, data });
        });

        it("should translate duplicated device ip errors", async () => {
            const error = new Error("duplicate");
            error.code = "23505";
            error.constraint = "devices_ip_unique";
            devicesModel.update.mockRejectedValue(error);
            await expect(devicesService.update({ clientTx: {}, id: "device-1", data: {} })).rejects.toMatchObject({
                code: "DEVICE_IP_ALREADY_IN_USE"
            });
        });
    });

    describe("delete", () => {
        it("should delete device", async () => {
            devicesModel.delete.mockResolvedValue({ id: "device-1" });
            await expect(devicesService.delete({ id: "device-1" })).resolves.toEqual({ id: "device-1" });
            expect(devicesModel.delete).toHaveBeenCalledWith({ id: "device-1" });
        });
    });
});
