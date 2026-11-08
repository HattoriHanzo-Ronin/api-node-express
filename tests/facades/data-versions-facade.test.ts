import { beforeEach, describe, expect, it, vi } from "vitest";
import DefaultDataVersionsFacade from "../../src/facades/impl/default-data-versions-facade.js";
import type { DataVersionsFacadeDependencies } from "../../src/types/default-data-versions-facade.js";
import { USER_ROLE } from "../../src/config/constants.js";

const createServiceMock = () => ({ getById: vi.fn(), getByIds: vi.fn() });
const createMapperMock = () => ({ versionsToDomain: vi.fn() });
const createFtpMock = () => ({ getHash: vi.fn() });

describe("DataVersionsFacade", () => {
    let service: ReturnType<typeof createServiceMock>;
    let mapper: ReturnType<typeof createMapperMock>;
    let ftpFacade: ReturnType<typeof createFtpMock>;
    let facade: DefaultDataVersionsFacade;

    beforeEach(() => {
        service = createServiceMock();
        mapper = createMapperMock();
        ftpFacade = createFtpMock();
        facade = new DefaultDataVersionsFacade({
            dataVersionsService: service,
            dataVersionsMapper: mapper,
            ftpFacade: ftpFacade as unknown as DataVersionsFacadeDependencies["ftpFacade"]
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

    it("returns a FTP directory version", async () => {
        const data = { dir: "files", authUser: { id: "user-id", roles: [USER_ROLE.ftp] } };
        ftpFacade.getHash.mockResolvedValue("directory-hash");
        await expect(facade.getFtp(data)).resolves.toEqual({ version: "directory-hash" });
        expect(ftpFacade.getHash).toHaveBeenCalledWith(data);
    });
});
