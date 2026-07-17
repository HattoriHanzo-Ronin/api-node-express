import { beforeEach, describe, expect, it, vi } from "vitest";
import RouterResolver from "../../src/devices-routers/router-resolver.js";
import DevicesFacade from "../../src/facades/devices-facade.js";

const routerResolverMock = vi.hoisted(() => ({
    impl: { delete: vi.fn(), create: vi.fn() },
    resolver: vi.fn()
}));

vi.mock("../../src/devices-routers/router-resolver.js", () => ({
    default: routerResolverMock.resolver
}));

describe("DevicesFacade", () => {
    let devicesService;
    let devicesMapper;
    let connectionsService;
    let devicesFacade;
    const tx = async (cb) => cb({});

    beforeEach(() => {
        vi.clearAllMocks();
        devicesService = {
            getAll: vi.fn(),
            getById: vi.fn(),
            getAllowedDevices: vi.fn(),
            getNotAllowedDevices: vi.fn(),
            getRoutersByAllowedDevice: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        };
        devicesMapper = {
            deviceToDomain: vi.fn((source) => source),
            devicesToDomain: vi.fn((source) => source.devices)
        };
        connectionsService = {
            getByDevices: vi.fn(),
            createMany: vi.fn(),
            update: vi.fn()
        };
        routerResolverMock.resolver.mockImplementation(class { constructor() { return routerResolverMock.impl; } });
        devicesFacade = new DevicesFacade({ devicesService, devicesMapper, connectionsService, tx });
    });

    it("should get all devices and map their connections", async () => {
        const connection = { device_id: "device-1", mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" };
        devicesService.getAll.mockResolvedValue([{ id: "device-1", name: "Desktop" }]);
        connectionsService.getByDevices.mockResolvedValue([connection]);

        await expect(devicesFacade.getAll()).resolves.toEqual([{ id: "device-1", name: "Desktop" }]);
        expect(connectionsService.getByDevices).toHaveBeenCalledWith({ devicesId: ["device-1"] });
        expect(devicesMapper.devicesToDomain).toHaveBeenCalledWith({
            devices: [{ id: "device-1", name: "Desktop" }],
            connections: [connection]
        });
    });

    it("should create a device with its connections in a transaction", async () => {
        const connection = { device_id: "device-1", mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" };
        const device = {
            name: "Desktop",
            type: "CLIENT",
            connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
        };
        devicesService.create.mockResolvedValue({ id: "device-1", name: "Desktop", type: "CLIENT" });
        connectionsService.createMany.mockResolvedValue([connection]);
        const deviceData = { name: device.name, type: device.type };

        await expect(devicesFacade.create({ device })).resolves.toEqual({
            id: "device-1",
            name: "Desktop",
            type: "CLIENT",
            connections: [connection]
        });
        expect(devicesService.create).toHaveBeenCalledWith({ clientTx: {}, device: deviceData });
        expect(connectionsService.createMany).toHaveBeenCalledWith({
            clientTx: {},
            deviceId: "device-1",
            connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
        });
    });

    it("should synchronize router whitelist when updating a device name", async () => {
        const data = { id: "device-1", name: "New Name" };
        vi.spyOn(devicesFacade, "getById")
            .mockResolvedValueOnce({
                id: "device-1",
                name: "Old Name",
                connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
            })
            .mockResolvedValueOnce({
                id: "device-1",
                name: "New Name",
                connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
            });
        devicesService.update.mockResolvedValue({ id: "device-1", name: "New Name", type: "CLIENT" });
        devicesService.getRoutersByAllowedDevice.mockResolvedValue([
            {
                id: "router-1",
                name: "Router",
                model: "TP-Link Archer AX53",
                connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN", key: "white_list_1" }]
            }
        ]);

        await devicesFacade.update({ data });

        expect(devicesService.update).toHaveBeenCalledWith({ clientTx: {}, id: data.id, data: { name: data.name } });
        expect(RouterResolver).toHaveBeenCalled();
        expect(routerResolverMock.impl.delete).toHaveBeenCalledWith({ key: "white_list_1", mac: "AA:BB:CC:DD:EE:01" });
        expect(routerResolverMock.impl.create).toHaveBeenCalledWith({
            key: "white_list_1",
            mac: "AA:BB:CC:DD:EE:01",
            name: data.name
        });
    });

    it("should delete router whitelist entries before deleting the device", async () => {
        vi.spyOn(devicesFacade, "getById").mockResolvedValue({
            id: "device-1",
            name: "Desktop",
            connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
        });
        devicesService.getRoutersByAllowedDevice.mockResolvedValue([
            {
                id: "router-1",
                name: "Router",
                model: "TP-Link Archer AX53",
                connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN", key: "white_list_1" }]
            }
        ]);
        devicesService.delete.mockResolvedValue({ id: "device-1" });

        await expect(devicesFacade.delete({ id: "device-1" })).resolves.toEqual({ id: "device-1" });
        expect(routerResolverMock.impl.delete).toHaveBeenCalledWith({ key: "white_list_1", mac: "AA:BB:CC:DD:EE:01" });
        expect(devicesService.delete).toHaveBeenCalledWith({ id: "device-1" });
    });
});
