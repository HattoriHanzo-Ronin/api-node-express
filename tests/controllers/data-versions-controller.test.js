import { beforeEach, describe, expect, it, vi } from "vitest";
import DataVersionsController from "../../src/controllers/data-versions-controller.js";

describe("DataVersionsController", () => {
    let dataVersionsFacade;
    let controller;
    let req;
    let res;

    beforeEach(() => {
        dataVersionsFacade = { getById: vi.fn(), getFtp: vi.fn() };
        controller = new DataVersionsController({ dataVersionsFacade });
        req = { query: { id: "devices, users" }, user: { id: "user-id", username: "ronin" } };
        res = { json: vi.fn() };
    });

    describe("getById", () => {
        it("should get a data version by resource identifier", async () => {
            const dataVersion = { devices: "2", users: "4" };
            dataVersionsFacade.getById.mockResolvedValue(dataVersion);
            await controller.getById(req, res);
            expect(dataVersionsFacade.getById).toHaveBeenCalledWith({ id: ["devices", "users"] });
            expect(res.json).toHaveBeenCalledWith(dataVersion);
        });

        it("should normalize a single resource identifier as an array", async () => {
            req.query.id = "users";
            dataVersionsFacade.getById.mockResolvedValue({ users: "4" });
            await controller.getById(req, res);
            expect(dataVersionsFacade.getById).toHaveBeenCalledWith({ id: ["users"] });
            expect(res.json).toHaveBeenCalledWith({ users: "4" });
        });

        it("should fail when the resource identifier is missing", async () => {
            req.query = {};
            await expect(controller.getById(req, res)).rejects.toThrow("Error al validar los datos");
            expect(dataVersionsFacade.getById).not.toHaveBeenCalled();
        });

        it("should fail when the resource identifier list is malformed", async () => {
            req.query.id = "devices,,users";
            await expect(controller.getById(req, res)).rejects.toThrow("Error al validar los datos");
            expect(dataVersionsFacade.getById).not.toHaveBeenCalled();
        });

        it("should fail when a resource identifier is unknown", async () => {
            req.query.id = "devices,unknown";
            await expect(controller.getById(req, res)).rejects.toThrow("Error al validar los datos");
            expect(dataVersionsFacade.getById).not.toHaveBeenCalled();
        });
    });

    describe("getFtp", () => {
        it("should get a FTP directory version", async () => {
            dataVersionsFacade.getFtp.mockResolvedValue({ version: "directory-hash" });
            req.query = { dir: "   /files   " };
            await controller.getFtp(req, res);
            expect(dataVersionsFacade.getFtp).toHaveBeenCalledWith({ dir: "/files", authUser: req.user });
            expect(res.json).toHaveBeenCalledWith({ version: "directory-hash" });
        });

        it("should use the root directory by default", async () => {
            req.query = {};
            await controller.getFtp(req, res);
            expect(dataVersionsFacade.getFtp).toHaveBeenCalledWith({ dir: ".", authUser: req.user });
        });

        it("should fail when dir contains traversal", async () => {
            req.query = { dir: "../secret" };
            await expect(controller.getFtp(req, res)).rejects.toThrow("Error al validar los datos");
            expect(dataVersionsFacade.getFtp).not.toHaveBeenCalled();
        });
    });
});
