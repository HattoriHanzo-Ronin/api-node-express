import { beforeEach, describe, expect, it, vi } from "vitest";
import DataVersionsFacade from "../../src/facades/data-versions-facade.js";

describe("DataVersionsFacade", () => {
    let dataVersionsService;
    let dataVersionsMapper;
    let ftpFacade;
    let dataVersionsFacade;

    beforeEach(() => {
        dataVersionsService = { getById: vi.fn(), getByIds: vi.fn() };
        dataVersionsMapper = { versionsToDomain: vi.fn() };
        ftpFacade = { getHash: vi.fn() };
        dataVersionsFacade = new DataVersionsFacade({ dataVersionsService, dataVersionsMapper, ftpFacade });
    });

    it("should return database data versions", async () => {
        const source = [{ id: "devices", version: "2" }, { id: "users", version: "4" }];
        dataVersionsService.getByIds.mockResolvedValue(source);
        dataVersionsMapper.versionsToDomain.mockReturnValue({ devices: "2", users: "4" });
        await expect(dataVersionsFacade.getById({ id: ["devices", "users"] })).resolves.toEqual({
            devices: "2",
            users: "4"
        });
        expect(dataVersionsService.getByIds).toHaveBeenCalledWith({ ids: ["devices", "users"] });
        expect(dataVersionsMapper.versionsToDomain).toHaveBeenCalledWith(source);
    });

    it("should return a FTP directory version", async () => {
        const data = { dir: "files", authUser: { id: "user-id", username: "ronin" } };
        ftpFacade.getHash.mockResolvedValue("directory-hash");
        await expect(dataVersionsFacade.getFtp(data)).resolves.toEqual({ version: "directory-hash" });
        expect(ftpFacade.getHash).toHaveBeenCalledWith(data);
    });
});
