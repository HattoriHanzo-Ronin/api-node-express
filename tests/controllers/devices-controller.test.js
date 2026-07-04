import { beforeEach, describe, expect, it, vi } from "vitest";
import DevicesController from "../../controllers/devices-controller.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("DevicesController", () => {
    let devicesFacade;
    let controller;
    let req;
    let res;

    beforeEach(() => {
        devicesFacade = {
            getAll: vi.fn(),
            getById: vi.fn(),
            getAllowedDevices: vi.fn(),
            getNotAllowedDevices: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        };
        controller = new DevicesController({ devicesFacade });
        req = { params: {}, body: validClient() };
        res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    });

    it("should get all devices", async () => {
        devicesFacade.getAll.mockResolvedValue([]);
        await controller.getAll(req, res);
        expect(devicesFacade.getAll).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith([]);
    });

    it("should get device by id", async () => {
        req.params.id = UUID;
        devicesFacade.getById.mockResolvedValue({ id: UUID });
        await controller.getById(req, res);
        expect(devicesFacade.getById).toHaveBeenCalledWith({ id: UUID });
        expect(res.json).toHaveBeenCalledWith({ id: UUID });
    });

    it("should get allowed devices", async () => {
        req.params.id = UUID;
        devicesFacade.getAllowedDevices.mockResolvedValue([]);
        await controller.getAllowedDevices(req, res);
        expect(devicesFacade.getAllowedDevices).toHaveBeenCalledWith({ routerId: UUID });
        expect(res.json).toHaveBeenCalledWith([]);
    });

    it("should get not allowed devices", async () => {
        req.params.id = UUID;
        devicesFacade.getNotAllowedDevices.mockResolvedValue([]);
        await controller.getNotAllowedDevices(req, res);
        expect(devicesFacade.getNotAllowedDevices).toHaveBeenCalledWith({ routerId: UUID });
        expect(res.json).toHaveBeenCalledWith([]);
    });

    it("should create device", async () => {
        devicesFacade.create.mockResolvedValue({ id: UUID });
        await controller.create(req, res);
        expect(devicesFacade.create).toHaveBeenCalledWith({ device: expect.objectContaining(validClient()) });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ id: UUID });
    });

    it("should update device", async () => {
        req.body = { id: UUID, name: "Desktop Updated" };
        devicesFacade.update.mockResolvedValue({ id: UUID });
        await controller.update(req, res);
        expect(devicesFacade.update).toHaveBeenCalledWith({ data: expect.objectContaining(req.body) });
        expect(res.json).toHaveBeenCalledWith({ id: UUID });
    });

    it("should delete device", async () => {
        req.params.id = UUID;
        devicesFacade.delete.mockResolvedValue({ id: UUID });
        await controller.delete(req, res);
        expect(devicesFacade.delete).toHaveBeenCalledWith({ id: UUID });
        expect(res.json).toHaveBeenCalledWith({ id: UUID });
    });

    describe("schema validation", () => {
        it("should fail with invalid name format", async () => {
            req.body.name = "Desk@top";
            await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail with name below minimum length", async () => {
            req.body.name = "abc";
            await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail with invalid type enum", async () => {
            req.body.type = "INVALID";
            await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail with empty connections", async () => {
            req.body.connections = [];
            await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail with invalid uuid", async () => {
            req.body = { id: "BAD_ID" };
            await expect(controller.update(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });

    describe("superRefine validation", () => {
        it("should fail when router does not specify mac filter support", async () => {
            req.body = validRouter();
            delete req.body.mac_filter;
            await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail when router with mac filter does not specify model", async () => {
            req.body = validRouter();
            delete req.body.model;
            await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail when router does not specify admin password", async () => {
            req.body = validRouter();
            delete req.body.admin_pass;
            await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail when router does not specify ip", async () => {
            req.body = validRouter();
            delete req.body.ip;
            await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail when client uses mac filtering", async () => {
            req.body.mac_filter = true;
            await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail when client uses admin password", async () => {
            req.body.admin_pass = "Password123!";
            await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail when client uses wifi password", async () => {
            req.body.wifi_pass = "WifiPass123!";
            await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail when server does not specify ip", async () => {
            req.body = { ...validClient(), name: "Server Test", type: "SERVER" };
            await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail when connections contain duplicated ctypes", async () => {
            req.body.connections = [
                { mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" },
                { mac: "AA:BB:CC:DD:EE:02", ctype: "LAN" }
            ];
            await expect(controller.create(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });
});

function validClient() {
    return {
        name: "Desktop Test",
        connections: [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" }],
        type: "CLIENT"
    };
}

function validRouter() {
    return {
        name: "Router Test",
        model: "TP-Link Archer AX53",
        connections: [{ mac: "AA:BB:CC:DD:EE:10", ctype: "LAN" }],
        type: "ROUTER",
        ip: "192.168.1.1",
        admin_pass: "Password123!",
        wifi_pass: "WifiPass123!",
        mac_filter: true
    };
}
