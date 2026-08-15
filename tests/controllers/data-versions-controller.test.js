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
        req = { params: { id: "devices" } };
        res = { json: vi.fn() };
    });

    it("should get a data version by resource identifier", async () => {
        const dataVersion = { version: "2" };
        dataVersionsService.getById.mockResolvedValue(dataVersion);

        await controller.getById(req, res);

        expect(dataVersionsService.getById).toHaveBeenCalledWith({ id: "devices" });
        expect(res.json).toHaveBeenCalledWith(dataVersion);
    });
});
