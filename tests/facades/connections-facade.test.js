import { beforeEach, describe, expect, it, vi } from "vitest";
import ConnectionsFacade from "../../src/facades/connections-facade.js";
import ConnectionsMapper from "../../src/mappers/connections-mapper.js";

describe("ConnectionsFacade", () => {
    let connectionsService;
    let connectionsFacade;

    beforeEach(() => {
        connectionsService = {
            getByDevices: vi.fn(),
            createMany: vi.fn(),
            update: vi.fn()
        };
        connectionsFacade = new ConnectionsFacade({
            connectionsService,
            connectionsMapper: ConnectionsMapper
        });
    });

    it("should group domain connections by device", async () => {
        connectionsService.getByDevices.mockResolvedValue([
            { device_id: "device-1", mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" },
            { device_id: "device-1", mac: "AA:BB:CC:DD:EE:02", ctype: "WIFI" },
            { device_id: "device-2", mac: "AA:BB:CC:DD:EE:03", ctype: "LAN" }
        ]);

        await expect(connectionsFacade.getByDevices({ devicesId: ["device-1", "device-2"] })).resolves.toEqual(
            new Map([
                [
                    "device-1",
                    [
                        { mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" },
                        { mac: "AA:BB:CC:DD:EE:02", ctype: "WIFI" }
                    ]
                ],
                ["device-2", [{ mac: "AA:BB:CC:DD:EE:03", ctype: "LAN" }]]
            ])
        );
    });

    it("should persist and return domain connections when creating them", async () => {
        connectionsService.createMany.mockResolvedValue([
            { device_id: "device-1", mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }
        ]);

        await expect(
            connectionsFacade.createMany({
                clientTx: {},
                deviceId: "device-1",
                connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
            })
        ).resolves.toEqual([{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]);
        expect(connectionsService.createMany).toHaveBeenCalledWith({
            clientTx: {},
            connections: [{ device_id: "device-1", mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
        });
    });

    it("should return domain connections for every update result", async () => {
        connectionsService.update.mockResolvedValue({
            deletedConnections: [{ device_id: "device-1", mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }],
            updatedConnections: [{ device_id: "device-1", mac: "AA:BB:CC:DD:EE:02", ctype: "WIFI" }]
        });

        await expect(
            connectionsFacade.update({
                clientTx: {},
                deviceId: "device-1",
                connections: [{ mac: "AA:BB:CC:DD:EE:02", ctype: "WIFI" }],
                oldConnections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
            })
        ).resolves.toEqual({
            deletedConnections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }],
            updatedConnections: [{ mac: "AA:BB:CC:DD:EE:02", ctype: "WIFI" }]
        });
    });
});
