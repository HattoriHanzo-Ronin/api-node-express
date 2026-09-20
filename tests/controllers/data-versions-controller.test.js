import { beforeEach, describe, expect, it, vi } from "vitest";
import DataVersionsController from "../../src/controllers/data-versions-controller.js";

describe("DataVersionsController", () => {
    let dataVersionsService;
    let controller;
    let req;
    let res;

    beforeEach(() => {
        dataVersionsService = { getById: vi.fn() };
        controller = new DataVersionsController({ dataVersionsService });
        req = { query: { id: "devices, users" } };
        res = { json: vi.fn() };
    });

    it("should get a data version by resource identifier", async () => {
        const dataVersion = { devices: "2", users: "4" };
        dataVersionsService.getById.mockResolvedValue(dataVersion);

        await controller.getById(req, res);

        expect(dataVersionsService.getById).toHaveBeenCalledWith({ id: ["devices", "users"] });
        expect(res.json).toHaveBeenCalledWith(dataVersion);
    });

    it("should normalize a single resource identifier as an array", async () => {
        req.query.id = "users";
        dataVersionsService.getById.mockResolvedValue({ users: "4" });

        await controller.getById(req, res);

        expect(dataVersionsService.getById).toHaveBeenCalledWith({ id: ["users"] });
        expect(res.json).toHaveBeenCalledWith({ users: "4" });
    });

    it("should fail when the resource identifier is missing", async () => {
        req.query = {};

        await expect(controller.getById(req, res)).rejects.toThrow("Error al validar los datos");
        expect(dataVersionsService.getById).not.toHaveBeenCalled();
    });

    it("should fail when the resource identifier list is malformed", async () => {
        req.query.id = "devices,,users";

        await expect(controller.getById(req, res)).rejects.toThrow("Error al validar los datos");
        expect(dataVersionsService.getById).not.toHaveBeenCalled();
    });

    it("should fail when a resource identifier is unknown", async () => {
        req.query.id = "devices,unknown";

        await expect(controller.getById(req, res)).rejects.toThrow("Error al validar los datos");
        expect(dataVersionsService.getById).not.toHaveBeenCalled();
    });
});
