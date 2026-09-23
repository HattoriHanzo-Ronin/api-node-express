import { beforeEach, describe, expect, it, vi } from "vitest";
import DataVersionsFacade from "../../src/facades/data-versions-facade.js";

describe("DataVersionsFacade", () => {
    let dataVersionsService;
    let ftpFacade;
    let dataVersionsFacade;

    beforeEach(() => {
        dataVersionsService = { getById: vi.fn() };
        ftpFacade = { getHash: vi.fn() };
        dataVersionsFacade = new DataVersionsFacade({ dataVersionsService, ftpFacade });
    });

    it("should return database data versions", async () => {
        dataVersionsService.getById.mockResolvedValue({ devices: "2", users: "4" });
        await expect(dataVersionsFacade.getById({ id: ["devices", "users"] })).resolves.toEqual({
            devices: "2",
            users: "4"
        });
        expect(dataVersionsService.getById).toHaveBeenCalledWith({ id: ["devices", "users"] });
    });

    it("should return a FTP directory version", async () => {
        const data = { dir: "/files", authUser: { id: "user-id", username: "ronin" } };
        ftpFacade.getHash.mockResolvedValue("directory-hash");
        await expect(dataVersionsFacade.getFtp(data)).resolves.toEqual({ version: "directory-hash" });
        expect(ftpFacade.getHash).toHaveBeenCalledWith(data);
    });
});
