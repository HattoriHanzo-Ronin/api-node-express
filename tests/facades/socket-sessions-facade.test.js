import { beforeEach, describe, expect, it, vi } from "vitest";
import SocketSessionsFacade from "../../src/facades/socket-sessions-facade.js";

describe("SocketSessionsFacade", () => {
    let socketSessionsService;
    let dataVersionsFacade;
    let facade;

    beforeEach(() => {
        socketSessionsService = { activity: vi.fn() };
        dataVersionsFacade = { getById: vi.fn(), getFtp: vi.fn() };
        facade = new SocketSessionsFacade({ socketSessionsService, dataVersionsFacade });
    });

    it("should return versions authorized by the authenticated user role", async () => {
        const authUser = { id: "user-id", roles: ["NET"] };
        dataVersionsFacade.getById.mockResolvedValue({ devices: "2", whitelist: "3" });
        await expect(facade.getVersions({ authUser, dir: ".", entities: ["devices", "whitelist"], id: "session-id", webSocket: {} }))
            .resolves.toEqual({ devices: "2", whitelist: "3" });
        expect(socketSessionsService.activity).toHaveBeenCalledOnce();
        expect(dataVersionsFacade.getById).toHaveBeenCalledWith({ id: ["devices", "whitelist"] });
    });

    it("should reject a version without its required role", async () => {
        await expect(facade.getVersions({
            authUser: { id: "user-id", roles: ["NET"] },
            dir: ".",
            entities: ["users"],
            id: "session-id",
            webSocket: {}
        })).rejects.toMatchObject({ code: "ACL_PERMISSION_DENIED" });
        expect(dataVersionsFacade.getById).not.toHaveBeenCalled();
    });

    it("should return a FTP directory hash to FTP users", async () => {
        const authUser = { id: "user-id", roles: ["FTP"] };
        dataVersionsFacade.getFtp.mockResolvedValue({ version: "directory-hash" });
        await expect(facade.getVersions({ authUser, dir: "files", entities: ["ftp"], id: "session-id", webSocket: {} }))
            .resolves.toEqual({ ftp: "directory-hash" });
        expect(dataVersionsFacade.getFtp).toHaveBeenCalledWith({ authUser, dir: "files" });
    });
});
