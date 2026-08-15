import { beforeEach, describe, expect, it, vi } from "vitest";
import DataVersionsService from "../../src/services/data-versions-service.js";

describe("DataVersionsService", () => {
    let dataVersionsModel;
    let dataVersionsService;

    beforeEach(() => {
        dataVersionsModel = { getById: vi.fn(), increment: vi.fn() };
        dataVersionsService = new DataVersionsService({ dataVersionsModel });
    });

    describe("getById", () => {
        it("should return a data version by resource identifier", async () => {
            dataVersionsModel.getById.mockResolvedValue({ version: "2" });
            await expect(dataVersionsService.getById({ id: "devices" })).resolves.toEqual({
                version: "2"
            });
            expect(dataVersionsModel.getById).toHaveBeenCalledWith({ id: "devices" });
        });
    });

    describe("increment", () => {
        it("should increment a data version", async () => {
            dataVersionsModel.increment.mockResolvedValue();
            await expect(dataVersionsService.increment({ clientTx: {}, id: "ftp" })).resolves.toBeUndefined();
            expect(dataVersionsModel.increment).toHaveBeenCalledWith({ clientTx: {}, id: "ftp" });
        });
    });
});
