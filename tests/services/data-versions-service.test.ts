import { beforeEach, describe, expect, it, vi } from "vitest";
import DefaultDataVersionsService from "../../src/services/impl/default-data-versions-service.js";

const createModelMock = () => ({ getById: vi.fn(), getByIds: vi.fn() });

describe("DataVersionsService", () => {
    let model: ReturnType<typeof createModelMock>;
    let service: DefaultDataVersionsService;

    beforeEach(() => {
        model = createModelMock();
        service = new DefaultDataVersionsService({ dataVersionsModel: model });
    });

    it("returns a data version by resource identifier", async () => {
        model.getById.mockResolvedValue({ version: "2" });
        await expect(service.getById({ id: "devices" })).resolves.toEqual({ version: "2" });
        expect(model.getById).toHaveBeenCalledWith({ id: "devices" });
    });

    it("returns data versions by resource identifiers", async () => {
        const versions = [
            { id: "users", version: "4" },
            { id: "devices", version: "2" }
        ];
        model.getByIds.mockResolvedValue(versions);
        await expect(service.getByIds({ ids: ["users", "devices"] })).resolves.toEqual(versions);
        expect(model.getByIds).toHaveBeenCalledWith({ ids: ["users", "devices"] });
    });
});
