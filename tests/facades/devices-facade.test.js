import { beforeEach, describe, expect, it, vi } from "vitest";
import DevicesFacade from "../../src/facades/devices-facade.js";
import DevicesMapper from "../../src/mappers/devices-mapper.js";

describe("DevicesFacade", () => {
    let devicesService;
    let dataVersionsFacade;
    let devicesMapper;
    let connectionsFacade;
    let routerAutomation;
    let routerCpanel;
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
        dataVersionsFacade = {
            getById: vi.fn(({ id }) => {
                if (Array.isArray(id)) {
                    return Promise.resolve({ devices: "2", whitelist: "3" });
                }
                return Promise.resolve({ version: id === "devices" ? "2" : "3" });
            })
        };
        devicesMapper = {
            createDeviceSource: vi.fn((source) => source),
            deviceToDomain: vi.fn(({ source, connections }) => ({ ...source, connections })),
            devicesToDomain: vi.fn((source) => source.devices),
            routersToAutomation: vi.fn((source) => source)
        };
        connectionsFacade = {
            getByDevices: vi.fn().mockResolvedValue(new Map()),
            connectionsByDeviceToDomain: vi.fn(({ source }) =>
                new Map(source.map(({ device_id: deviceId, mac, ctype }) => [deviceId, [{ mac, ctype }]]))
            ),
            createMany: vi.fn(),
            update: vi.fn()
        };
        routerAutomation = vi.fn(function RouterAutomation() {
            return { delete: vi.fn(), create: vi.fn() };
        });
        routerCpanel = { create: vi.fn(), navigate: vi.fn(), close: vi.fn() };
        devicesFacade = new DevicesFacade({
            devicesService,
            dataVersionsFacade,
            devicesMapper,
            connectionsFacade,
            routerAutomation,
            routerCpanel,
            tx
        });
    });

    it("should get all devices and map their connections", async () => {
        devicesService.getAll.mockResolvedValue([{ id: "device-1", name: "Desktop" }]);
        connectionsFacade.getByDevices.mockResolvedValue(
            new Map([["device-1", [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]]])
        );

        await expect(devicesFacade.getAll()).resolves.toEqual({
            version: "2",
            data: [{ id: "device-1", name: "Desktop" }]
        });
        expect(connectionsFacade.getByDevices).toHaveBeenCalledWith({ devicesId: ["device-1"] });
        expect(devicesMapper.devicesToDomain).toHaveBeenCalledWith({
            devices: [{ id: "device-1", name: "Desktop" }],
            connectionsByDevice: new Map([["device-1", [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]]])
        });
    });

    it.each([
        ["allowed", "getAllowedDevices"],
        ["not allowed", "getNotAllowedDevices"]
    ])("should return %s devices mapped with their connections", async (_, method) => {
        const rows = [{ id: "device-1", name: "Desktop", type: "CLIENT", ctype: "LAN", mac: "AA:BB:CC:DD:EE:01" }];
        devicesService[method].mockResolvedValue(rows);
        devicesFacade = new DevicesFacade({
            devicesService,
            dataVersionsFacade,
            devicesMapper: new DevicesMapper({ routerAutomation }),
            connectionsFacade,
            routerAutomation,
            routerCpanel,
            tx
        });

        await expect(devicesFacade[method]({ routerId: "router-1" })).resolves.toEqual({
            version: { devices: "2", whitelist: "3" },
            data: [
                {
                    id: "device-1",
                    name: "Desktop",
                    type: "CLIENT",
                    connections: [{ ctype: "LAN", mac: "AA:BB:CC:DD:EE:01" }]
                }
            ]
        });
        expect(devicesService[method]).toHaveBeenCalledWith({ routerId: "router-1" });
        expect(dataVersionsFacade.getById).toHaveBeenCalledWith({ id: ["devices", "whitelist"] });
    });

    it("should create a device with its connections in a transaction", async () => {
        const device = {
            name: "Desktop",
            type: "CLIENT",
            connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
        };
        devicesService.create.mockResolvedValue({ id: "device-1", name: "Desktop", type: "CLIENT" });
        connectionsFacade.createMany.mockResolvedValue([{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]);
        const deviceData = { name: device.name, type: device.type };

        await expect(devicesFacade.create({ device })).resolves.toEqual({
            id: "device-1",
            name: "Desktop",
            type: "CLIENT",
            connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
        });
        expect(devicesService.create).toHaveBeenCalledWith({ clientTx: {}, device: deviceData });
        expect(connectionsFacade.createMany).toHaveBeenCalledWith({
            clientTx: {},
            deviceId: "device-1",
            connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
        });
    });

    it("should create a router control panel session from a stored router", async () => {
        vi.spyOn(devicesFacade, "getById").mockResolvedValue({
            id: "router-1",
            name: "Router principal",
            type: "ROUTER",
            ip: "192.168.1.1",
            admin_pass: "RouterPassword123!"
        });
        routerCpanel.create.mockResolvedValue({ id: "session-id" });

        await expect(devicesFacade.createRouterCpanel({
            authUser: { id: "user-id" },
            routerId: "router-1",
            clientType: "desktop",
            language: "es-ES",
            theme: "light"
        })).resolves.toEqual({ id: "session-id" });
        expect(routerCpanel.create).toHaveBeenCalledWith({
            ownerId: "user-id",
            routerName: "Router principal",
            routerIp: "192.168.1.1",
            routerPassword: "RouterPassword123!",
            clientType: "desktop",
            language: "es-ES",
            theme: "light"
        });
    });

    it("should reject a control panel session for a non-router device", async () => {
        vi.spyOn(devicesFacade, "getById").mockResolvedValue({ id: "device-1", type: "CLIENT" });
        await expect(devicesFacade.createRouterCpanel({
            authUser: { id: "user-id" },
            routerId: "device-1",
            clientType: "desktop"
        })).rejects.toMatchObject({ code: "ROUTER_CPANEL_NOT_ROUTER", status: 400 });
    });

    it("should proxy router control panel actions under the authenticated owner", async () => {
        routerCpanel.navigate.mockResolvedValue();
        routerCpanel.close.mockResolvedValue();
        const authUser = { id: "user-id" };
        await devicesFacade.navigateRouterCpanel({ authUser, sessionId: "session-id", action: "reload" });
        await devicesFacade.closeRouterCpanel({ authUser, sessionId: "session-id" });
        expect(routerCpanel.navigate).toHaveBeenCalledWith({ sessionId: "session-id", ownerId: "user-id", action: "reload" });
        expect(routerCpanel.close).toHaveBeenCalledWith({ sessionId: "session-id", ownerId: "user-id" });
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
        expect(routerAutomation).toHaveBeenCalled();
        const routerImpl = routerAutomation.mock.results[0].value;
        expect(routerImpl.delete).toHaveBeenCalledWith({ key: "white_list_1", mac: "AA:BB:CC:DD:EE:01" });
        expect(routerImpl.create).toHaveBeenCalledWith({
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
        expect(routerAutomation.mock.results[0].value.delete).toHaveBeenCalledWith({
            key: "white_list_1",
            mac: "AA:BB:CC:DD:EE:01"
        });
        expect(devicesService.delete).toHaveBeenCalledWith({ id: "device-1" });
    });
});
