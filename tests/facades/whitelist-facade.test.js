import { beforeEach, describe, expect, it, vi } from "vitest";
import WhitelistFacade from "../../src/facades/whitelist-facade.js";

describe("WhitelistFacade", () => {
    let whitelistService;
    let dataVersionsFacade;
    let devicesFacade;
    let routerAutomation;
    let socketSessionsFacade;
    let whitelistFacade;
    const tx = async (cb) => cb({});

    beforeEach(() => {
        vi.clearAllMocks();
        whitelistService = { getKey: vi.fn(), create: vi.fn(), delete: vi.fn() };
        dataVersionsFacade = { getById: vi.fn().mockResolvedValue({ version: "3" }) };
        devicesFacade = { getById: vi.fn() };
        const routerImpl = { generateKey: vi.fn(() => "white_list_1"), create: vi.fn(), delete: vi.fn() };
        routerAutomation = vi.fn(function RouterAutomation() {
            return routerImpl;
        });
        socketSessionsFacade = { notify: vi.fn() };
        whitelistFacade = new WhitelistFacade({
            whitelistService,
            dataVersionsFacade,
            devicesFacade,
            routerAutomation,
            socketSessionsFacade,
            tx
        });
    });

    it("should create whitelist entry and synchronize router", async () => {
        devicesFacade.getById
            .mockResolvedValueOnce({
                id: "device-1",
                name: "Desktop",
                connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
            })
            .mockResolvedValueOnce({ id: "router-1", name: "Router", model: "TP-Link Archer AX53" });
        whitelistService.getKey.mockResolvedValue("white_list_1");

        const result = await whitelistFacade.create({
            routerId: "router-1",
            allowedDevice: { id: "device-1", mac: "AA:BB:CC:DD:EE:01" }
        });

        expect(result).toEqual({ id: "device-1", mac: "AA:BB:CC:DD:EE:01" });
        expect(routerAutomation).toHaveBeenCalledWith({
            router: { id: "router-1", name: "Router", model: "TP-Link Archer AX53" }
        });
        expect(whitelistService.getKey).toHaveBeenCalledWith({
            routerId: "router-1",
            generateKey: expect.any(Function)
        });
        expect(whitelistService.create).toHaveBeenCalledWith({
            clientTx: {},
            whitelist: { router_id: "router-1", connection_mac: "AA:BB:CC:DD:EE:01", key: "white_list_1" }
        });
        expect(routerAutomation.mock.results[0].value.create).toHaveBeenCalledWith({
            key: "white_list_1",
            name: "Desktop",
            mac: "AA:BB:CC:DD:EE:01"
        });
        expect(socketSessionsFacade.notify).toHaveBeenCalledWith({ entity: "whitelist", data: { version: "3" } });
    });

    it("should delete whitelist entry and synchronize router", async () => {
        devicesFacade.getById
            .mockResolvedValueOnce({
                id: "device-1",
                name: "Desktop",
                connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
            })
            .mockResolvedValueOnce({ id: "router-1", name: "Router", model: "TP-Link Archer AX53" });
        whitelistService.delete.mockResolvedValue({ key: "white_list_1" });

        const result = await whitelistFacade.delete({
            routerId: "router-1",
            allowedDevice: { id: "device-1", mac: "AA:BB:CC:DD:EE:01" }
        });

        expect(result).toEqual({ id: "device-1", mac: "AA:BB:CC:DD:EE:01" });
        expect(whitelistService.delete).toHaveBeenCalledWith({
            clientTx: {},
            routerId: "router-1",
            mac: "AA:BB:CC:DD:EE:01"
        });
        expect(routerAutomation.mock.results[0].value.delete).toHaveBeenCalledWith({ key: "white_list_1", mac: "AA:BB:CC:DD:EE:01" });
        expect(socketSessionsFacade.notify).toHaveBeenCalledWith({ entity: "whitelist", data: { version: "3" } });
    });

    it("should fail when mac does not belong to allowed device", async () => {
        devicesFacade.getById.mockResolvedValue({
            id: "device-1",
            name: "Desktop",
            connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
        });

        await expect(
            whitelistFacade.create({
                routerId: "router-1",
                allowedDevice: { id: "device-1", mac: "AA:BB:CC:DD:EE:99" }
            })
        ).rejects.toThrow("La mac no pertenece al dispositivo especificado");
        expect(whitelistService.getKey).not.toHaveBeenCalled();
    });

    it("should translate router not found errors", async () => {
        devicesFacade.getById
            .mockResolvedValueOnce({
                id: "device-1",
                name: "Desktop",
                connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
            })
            .mockRejectedValueOnce(Object.assign(new Error("El dispositivo no existe"), { code: "DEVICE_NOT_FOUND" }));

        await expect(
            whitelistFacade.create({
                routerId: "missing-router",
                allowedDevice: { id: "device-1", mac: "AA:BB:CC:DD:EE:01" }
            })
        ).rejects.toThrow("El router no existe");
    });
});
