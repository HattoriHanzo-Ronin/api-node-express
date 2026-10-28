import { beforeEach, describe, expect, it, vi } from "vitest";
import DataVersionsService from "../../src/services/data-versions-service.js";

describe("DataVersionsService", () => {
    let dataVersionsModel;
    let dataVersionsService;

    beforeEach(() => {
        dataVersionsModel = { getById: vi.fn(), getByIds: vi.fn() };
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

        it("should return data versions by resource identifiers", async () => {
            const versions = [
                { id: "users", version: "4" },
                { id: "devices", version: "2" }
            ];
            dataVersionsModel.getByIds.mockResolvedValue(versions);

            await expect(dataVersionsService.getByIds({ ids: ["users", "devices"] })).resolves.toEqual(versions);
            expect(dataVersionsModel.getByIds).toHaveBeenCalledWith({ ids: ["users", "devices"] });
        });
    });
});
