import { beforeEach, describe, expect, it, vi } from "vitest";
import DataVersionsService from "../../src/services/data-versions-service.js";

describe("DataVersionsService", () => {
    let dataVersionsModel;
    let dataVersionsService;

    beforeEach(() => {
        dataVersionsModel = { getById: vi.fn(), getByIds: vi.fn(), increment: vi.fn() };
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

        it("should return data versions keyed by resource identifier", async () => {
            dataVersionsModel.getByIds.mockResolvedValue([
                { id: "ftp", version: "1" },
                { id: "devices", version: "2" }
            ]);

            await expect(dataVersionsService.getById({ id: ["ftp", "devices"] })).resolves.toEqual({
                ftp: "1",
                devices: "2"
            });
            expect(dataVersionsModel.getByIds).toHaveBeenCalledWith({ ids: ["ftp", "devices"] });
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
