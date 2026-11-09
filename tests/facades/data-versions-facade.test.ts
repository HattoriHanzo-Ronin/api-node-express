import { beforeEach, describe, expect, it, vi } from "vitest";
import DefaultDataVersionsFacade from "../../src/facades/impl/default-data-versions-facade.js";

const createServiceMock = () => ({ getById: vi.fn(), getByIds: vi.fn() });
const createMapperMock = () => ({ versionsToDomain: vi.fn() });

describe("DataVersionsFacade", () => {
    let service: ReturnType<typeof createServiceMock>;
    let mapper: ReturnType<typeof createMapperMock>;
    let facade: DefaultDataVersionsFacade;

    beforeEach(() => {
        service = createServiceMock();
        mapper = createMapperMock();
        facade = new DefaultDataVersionsFacade({
            dataVersionsService: service,
            dataVersionsMapper: mapper
        });
    });

    it("returns a single database version", async () => {
        service.getById.mockResolvedValue({ version: "2" });
        await expect(facade.getById({ id: "devices" })).resolves.toEqual({ version: "2" });
        expect(service.getById).toHaveBeenCalledWith({ id: "devices" });
    });

    it("returns database data versions", async () => {
        const source = [
            { id: "devices", version: "2" },
            { id: "users", version: "4" }
        ];
        service.getByIds.mockResolvedValue(source);
        mapper.versionsToDomain.mockReturnValue({ devices: "2", users: "4" });
        await expect(facade.getById({ id: ["devices", "users"] })).resolves.toEqual({ devices: "2", users: "4" });
        expect(service.getByIds).toHaveBeenCalledWith({ ids: ["devices", "users"] });
        expect(mapper.versionsToDomain).toHaveBeenCalledWith(source);
    });
});
