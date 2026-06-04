import { describe, expect, it, beforeEach, vi } from "vitest";
import DeviceController from "../../controllers/device-controller.js";

describe("DeviceController validation", () => {
    let deviceService;
    let controller;
    let req;
    let res;
    let next;

    beforeEach(() => {
        deviceService = { create: vi.fn(), update: vi.fn() };
        controller = new DeviceController({ deviceService });
        req = { body: { name: "Cliente", mac: "AA:BB:CC:DD:EE:01", intrface: "LAN", type: "CLIENT" } };
        res = { json: vi.fn() };
        next = vi.fn();
    });

    it("should create device", async () => {
        deviceService.create.mockResolvedValue(true);
        await controller.create(req, res, next);
        expect(deviceService.create).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(true);
    });

    it("should fail with invalid mac format", async () => {
        req.body.mac = "BAD_MAC";
        await expect(controller.create(req, res, next)).rejects.toThrow();
    });

    it("should fail with invalid field type", async () => {
        req.body.name = 123;
        await expect(controller.create(req, res, next)).rejects.toThrow();
    });

    it("should fail with invalid enum", async () => {
        req.body.intrface = "INVALID";
        await expect(controller.create(req, res, next)).rejects.toThrow();
    });

    it("should fail with missing required field", async () => {
        delete req.body.name;
        await expect(controller.create(req, res, next)).rejects.toThrow();
    });

    it("should fail if client has mac_filter", async () => {
        req.body.mac_filter = true;
        await expect(controller.create(req, res, next)).rejects.toThrow();
    });

    it("should fail if client has admin_pass", async () => {
        req.body.admin_pass = "password123";
        await expect(controller.create(req, res, next)).rejects.toThrow();
    });

    it("should fail if server has null ip", async () => {
        req.body = {
            name: "Servidor",
            mac: "AA:BB:CC:DD:EE:01",
            intrface: "LAN",
            type: "SERVER",
            ip: null
        };
        await expect(controller.create(req, res, next)).rejects.toThrow();
    });

    describe("router validation", () => {
        beforeEach(() => {
            req.body = {
                name: "RouterTest",
                mac: "AA:BB:CC:DD:EE:01",
                intrface: "LAN",
                type: "ROUTER",
                model: "TP-Link Archer AX53",
                ip: "192.168.1.1",
                admin_pass: "password123",
                mac_filter: true
            };
        });

        it("should fail if router has null mac_filter", async () => {
            req.body.mac_filter = null;
            await expect(controller.create(req, res, next)).rejects.toThrow();
        });

        it("should fail if router has null admin_pass", async () => {
            req.body.admin_pass = null;
            await expect(controller.create(req, res, next)).rejects.toThrow();
        });
    });

    describe("device id validation", () => {
        beforeEach(() => {
            req.body = { id: "550e8400-e29b-41d4-a716-446655440000" };
        });

        it("should validate with id", async () => {
            deviceService.update.mockResolvedValue(true);
            await controller.update(req, res, next);
            expect(deviceService.update).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(true);
        });

        it("should fail with invalid uuid", async () => {
            req.body.id = "BAD_ID";
            await expect(controller.update(req, res, next)).rejects.toThrow();
        });
    });
});
