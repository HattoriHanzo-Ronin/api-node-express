import { describe, expect, it, vi } from "vitest";
import ConnectionsService from "../../src/services/connections-service.js";

describe("ConnectionsService getByDevices", () => {
    it("should return device connections", async () => {
        const { connectionsModel, connectionsService } = setup();
        const connections = [connection()];
        connectionsModel.getByDevices.mockResolvedValue(connections);
        await expect(connectionsService.getByDevices({ devicesId: ["device-1"] })).resolves.toEqual(connections);
        expect(connectionsModel.getByDevices).toHaveBeenCalledWith({ devicesId: ["device-1"] });
    });
});

describe("ConnectionsService createMany", () => {
    it("should create device connections", async () => {
        const { connectionsModel, connectionsService } = setup();
        const connections = [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }];
        const createdConnections = [connection()];
        connectionsModel.insertMany.mockResolvedValue(createdConnections);
        const result = connectionsService.createMany({ clientTx: {}, deviceId: "device-1", connections });
        await expect(result).resolves.toEqual(createdConnections);
        expect(connectionsModel.insertMany).toHaveBeenCalledWith({ clientTx: {}, connections: createdConnections });
    });

    it("should fail if connections are not defined", async () => {
        const { connectionsService } = setup();
        await expect(connectionsService.createMany({ clientTx: {}, deviceId: "device-1" })).rejects.toMatchObject({
            code: "CONNECTION_REQUIRED"
        });
    });

    it("should translate duplicated mac errors", async () => {
        const { connectionsModel, connectionsService } = setup();
        const error = new Error("duplicate");
        error.code = "23505";
        connectionsModel.insertMany.mockRejectedValue(error);
        await expect(connectionsService.createMany(createParams())).rejects.toMatchObject({
            code: "CONNECTION_MAC_ALREADY_EXISTS"
        });
    });
});

describe("ConnectionsService update operations", () => {
    it("should return empty result when connections do not change", async () => {
        const { connectionsModel, connectionsService } = setup();
        const connections = [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }];
        const params = updateParams({ connections, oldConnections: connections });
        await expect(connectionsService.update(params)).resolves.toEqual({});
        expect(connectionsModel.deleteMany).not.toHaveBeenCalled();
        expect(connectionsModel.insertMany).not.toHaveBeenCalled();
        expect(connectionsModel.updateMany).not.toHaveBeenCalled();
    });

    it("should delete removed connection ctypes", async () => {
        const { connectionsModel, connectionsService } = setup();
        const connections = [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }];
        const oldConnections = [...connections, { mac: "AA:BB:CC:DD:EE:02", ctype: "WIFI" }];
        const deletedConnections = [connection({ mac: "AA:BB:CC:DD:EE:02", ctype: "WIFI" })];
        connectionsModel.deleteMany.mockResolvedValue(deletedConnections);
        await expect(connectionsService.update(updateParams({ connections, oldConnections }))).resolves.toEqual({
            deletedConnections
        });
        expect(connectionsModel.deleteMany).toHaveBeenCalledWith({ clientTx: {}, macs: ["AA:BB:CC:DD:EE:02"] });
    });

    it("should create new connection ctypes", async () => {
        const { connectionsModel, connectionsService } = setup();
        const oldConnections = [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }];
        const connections = [...oldConnections, { mac: "AA:BB:CC:DD:EE:02", ctype: "WIFI" }];
        const createdConnections = [connection({ mac: "AA:BB:CC:DD:EE:02", ctype: "WIFI" })];
        connectionsModel.insertMany.mockResolvedValue(createdConnections);
        await expect(connectionsService.update(updateParams({ connections, oldConnections }))).resolves.toEqual({
            createdConnections
        });
        expect(connectionsModel.insertMany).toHaveBeenCalledWith({ clientTx: {}, connections: createdConnections });
    });

    it("should update changed connection macs", async () => {
        const { connectionsModel, connectionsService } = setup();
        const oldConnections = [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }];
        const connections = [{ mac: "AA:BB:CC:DD:EE:02", ctype: "LAN" }];
        const updatedConnections = [connection({ mac: "AA:BB:CC:DD:EE:02" })];
        connectionsModel.updateMany.mockResolvedValue(updatedConnections);
        await expect(connectionsService.update(updateParams({ connections, oldConnections }))).resolves.toEqual({
            updatedConnections
        });
        expect(connectionsModel.updateMany).toHaveBeenCalledWith({ clientTx: {}, connections: updatedConnections });
    });
});

describe("ConnectionsService update combined operations and errors", () => {
    it("should execute delete, create and update operations when all connection groups change", async () => {
        const { connectionsModel, connectionsService } = setup();
        const oldConnections = [
            { mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" },
            { mac: "AA:BB:CC:DD:EE:02", ctype: "WIFI" }
        ];
        const connections = [
            { mac: "AA:BB:CC:DD:EE:03", ctype: "LAN" },
            { mac: "AA:BB:CC:DD:EE:04", ctype: "WAN" }
        ];
        const deletedConnections = [connection({ mac: "AA:BB:CC:DD:EE:02", ctype: "WIFI" })];
        const createdConnections = [connection({ mac: "AA:BB:CC:DD:EE:04", ctype: "WAN" })];
        const updatedConnections = [connection({ mac: "AA:BB:CC:DD:EE:03", ctype: "LAN" })];
        connectionsModel.deleteMany.mockResolvedValue(deletedConnections);
        connectionsModel.insertMany.mockResolvedValue(createdConnections);
        connectionsModel.updateMany.mockResolvedValue(updatedConnections);
        await expect(connectionsService.update(updateParams({ connections, oldConnections }))).resolves.toEqual({
            deletedConnections,
            createdConnections,
            updatedConnections
        });
    });

    it("should translate duplicated mac errors", async () => {
        const { connectionsModel, connectionsService } = setup();
        const error = new Error("duplicate");
        error.code = "23505";
        connectionsModel.updateMany.mockRejectedValue(error);
        await expect(connectionsService.update(updateParams())).rejects.toMatchObject({
            code: "CONNECTION_MAC_ALREADY_EXISTS"
        });
    });

    it("should translate unexpected update errors", async () => {
        const { connectionsModel, connectionsService } = setup();
        connectionsModel.updateMany.mockRejectedValue(new Error("database error"));
        await expect(connectionsService.update(updateParams())).rejects.toMatchObject({
            code: "CONNECTION_UPDATE_FAILED"
        });
    });
});

function setup() {
    const connectionsModel = { getByDevices: vi.fn(), insertMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() };
    return { connectionsModel, connectionsService: new ConnectionsService({ connectionsModel }) };
}

function connection({ mac = "AA:BB:CC:DD:EE:01", ctype = "LAN" } = {}) {
    return { device_id: "device-1", mac, ctype };
}

function createParams() {
    return { clientTx: {}, deviceId: "device-1", connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }] };
}

function updateParams({ connections, oldConnections } = {}) {
    return {
        clientTx: {},
        deviceId: "device-1",
        connections: connections ?? [{ mac: "AA:BB:CC:DD:EE:02", ctype: "LAN" }],
        oldConnections: oldConnections ?? [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
    };
}
