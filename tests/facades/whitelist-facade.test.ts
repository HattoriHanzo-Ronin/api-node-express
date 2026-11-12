import { beforeEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("../../src/utils/logger/logger.js", () => ({ default: { getLogger: () => logger } }));
import type { WhitelistFacadeDependencies } from "../../src/types/whitelist/default-whitelist-facade.js";
import ApiError from "../../src/utils/error/api-error.js";
import { API_ERROR } from "../../src/config/errors.js";
import WhitelistFacade from "../../src/facades/impl/default-whitelist-facade.js";

const createWhitelistServiceMock = () => ({ getKey: vi.fn(), create: vi.fn(), delete: vi.fn() });
const createDevicesFacadeMock = () => ({ getById: vi.fn() });
const createRouterAutomationMock = () => {
    const routerImpl = { generateKey: vi.fn(() => "white_list_1"), create: vi.fn(), delete: vi.fn() };
    return vi.fn(function RouterAutomation() {
        return routerImpl;
    });
};
const createSocketSessionsMock = () => ({ notify: vi.fn() });

describe("WhitelistFacade", () => {
    let whitelistService: ReturnType<typeof createWhitelistServiceMock>;
    let devicesFacade: ReturnType<typeof createDevicesFacadeMock>;
    let routerAutomation: ReturnType<typeof createRouterAutomationMock>;
    let socketSessionsFacade: ReturnType<typeof createSocketSessionsMock>;
    let whitelistFacade: WhitelistFacade<object>;
    const tx = async <Result>(cb: (clientTx: object) => Result | Promise<Result>): Promise<Result> => cb({});

    beforeEach(() => {
        vi.clearAllMocks();
        whitelistService = createWhitelistServiceMock();
        devicesFacade = createDevicesFacadeMock();
        routerAutomation = createRouterAutomationMock();
        socketSessionsFacade = createSocketSessionsMock();
        whitelistFacade = new WhitelistFacade({
            whitelistService,
            devicesFacade,
            routerAutomation,
            socketSessionsFacade,
            tx
        } as unknown as WhitelistFacadeDependencies<object>);
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
        expect(socketSessionsFacade.notify).toHaveBeenCalledWith({ entities: ["whitelist"] });
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "whitelist.operation.completed",
                context: "Router: router-1, device: device-1, operation: add"
            })
        );
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
        expect(routerAutomation.mock.results[0].value.delete).toHaveBeenCalledWith({
            key: "white_list_1",
            mac: "AA:BB:CC:DD:EE:01"
        });
        expect(socketSessionsFacade.notify).toHaveBeenCalledWith({ entities: ["whitelist"] });
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

    it("should rethrow non-API router errors", async () => {
        const error = Object.assign(new Error("unexpected"), { code: "DEVICE_NOT_FOUND" });
        devicesFacade.getById
            .mockResolvedValueOnce({
                id: "device-1",
                name: "Desktop",
                connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
            })
            .mockRejectedValueOnce(error);
        await expect(
            whitelistFacade.create({
                routerId: "router-1",
                allowedDevice: { id: "device-1", mac: "AA:BB:CC:DD:EE:01" }
            })
        ).rejects.toBe(error);
    });

    it("should translate router not found errors", async () => {
        devicesFacade.getById
            .mockResolvedValueOnce({
                id: "device-1",
                name: "Desktop",
                connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }]
            })
            .mockRejectedValueOnce(
                new ApiError({ message: "El dispositivo no existe", apiError: API_ERROR.deviceNotFound })
            );

        await expect(
            whitelistFacade.create({
                routerId: "missing-router",
                allowedDevice: { id: "device-1", mac: "AA:BB:CC:DD:EE:01" }
            })
        ).rejects.toThrow("El router no existe");
    });
});
