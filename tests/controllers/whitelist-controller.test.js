import { beforeEach, describe, expect, it, vi } from "vitest";
import WhitelistController from "../../controllers/whitelist-controller.js";

const ROUTER_ID = "550e8400-e29b-41d4-a716-446655440000";
const DEVICE_ID = "550e8400-e29b-41d4-a716-446655440001";

describe("WhitelistController", () => {
    let whitelistFacade;
    let controller;
    let req;
    let res;

    beforeEach(() => {
        whitelistFacade = { create: vi.fn(), delete: vi.fn() };
        controller = new WhitelistController({ whitelistFacade });
        req = {
            params: { id: ROUTER_ID },
            body: { id: DEVICE_ID, mac: "AA:BB:CC:DD:EE:01" }
        };
        res = { json: vi.fn() };
    });

    it("should create whitelist entry", async () => {
        whitelistFacade.create.mockResolvedValue({ id: DEVICE_ID, mac: "AA:BB:CC:DD:EE:01" });
        await controller.create(req, res);
        expect(whitelistFacade.create).toHaveBeenCalledWith({
            routerId: ROUTER_ID,
            allowedDevice: { id: DEVICE_ID, mac: "AA:BB:CC:DD:EE:01" }
        });
        expect(res.json).toHaveBeenCalledWith({ id: DEVICE_ID, mac: "AA:BB:CC:DD:EE:01" });
    });

    it("should delete whitelist entry", async () => {
        whitelistFacade.delete.mockResolvedValue({ id: DEVICE_ID, mac: "AA:BB:CC:DD:EE:01" });
        await controller.delete(req, res);
        expect(whitelistFacade.delete).toHaveBeenCalledWith({
            routerId: ROUTER_ID,
            allowedDevice: { id: DEVICE_ID, mac: "AA:BB:CC:DD:EE:01" }
        });
        expect(res.json).toHaveBeenCalledWith({ id: DEVICE_ID, mac: "AA:BB:CC:DD:EE:01" });
    });

    it("should fail with invalid router id", async () => {
        req.params.id = "BAD_ID";
        await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
    });

    it("should fail with invalid allowed device id", async () => {
        req.body.id = "BAD_ID";
        await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
    });

    it("should fail with invalid allowed device mac", async () => {
        req.body.mac = "BAD_MAC";
        await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
    });

    it("should fail with missing allowed device mac", async () => {
        delete req.body.mac;
        await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
    });
});
