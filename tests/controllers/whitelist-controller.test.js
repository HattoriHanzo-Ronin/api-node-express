import { describe, it, expect, beforeEach, vi } from "vitest";

import WhitelistController from "../../controllers/whitelist-controller.js";

describe("WhitelistController validation", () => {
    let whitelistService;
    let controller;
    let req;
    let res;
    let next;

    beforeEach(() => {
        whitelistService = { create: vi.fn() };
        controller = new WhitelistController({ whitelistService });
        req = {
            body: {
                router: {
                    id: "550e8400-e29b-41d4-a716-446655440000",
                    name: "Router Test",
                    mac: "AA:BB:CC:DD:EE:FF",
                    model: "Archer AX53",
                    ip: "192.168.1.1",
                    admin_pass: "Password123",
                    mac_filter: true
                },
                allowDevice: {
                    id: "550e8400-e29b-41d4-a716-446655440001",
                    name: "Samsung A54",
                    mac: "11:22:33:44:55:66"
                }
            }
        };
        res = { json: vi.fn() };
        next = vi.fn();
    });

    it("should create whitelist", async () => {
        whitelistService.create.mockResolvedValue(true);
        await controller.create(req, res, next);
        expect(whitelistService.create).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(true);
    });

    it("should trim router values", async () => {
        whitelistService.create.mockResolvedValue(true);
        req.body.router.name = "   Router Test   ";
        await controller.create(req, res, next);
        expect(whitelistService.create).toHaveBeenCalledWith({
            router: expect.objectContaining({ name: "Router Test" }),
            allowDevice: expect.any(Object)
        });
    });

    it("should fail with invalid router id", async () => {
        req.body.router.id = "invalid";
        await expect(controller.create(req, res, next)).rejects.toThrow();
    });

    it("should fail with invalid router ip", async () => {
        req.body.router.ip = "invalid-ip";
        await expect(controller.create(req, res, next)).rejects.toThrow();
    });

    it("should fail when router does not support mac filtering", async () => {
        req.body.router.mac_filter = false;
        await expect(controller.create(req, res, next)).rejects.toThrow();
    });

    it("should fail with invalid allow device mac", async () => {
        req.body.allowDevice.mac = "invalid";
        await expect(controller.create(req, res, next)).rejects.toThrow();
    });
});
