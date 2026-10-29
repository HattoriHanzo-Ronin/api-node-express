import { beforeEach, describe, expect, it, vi } from "vitest";
import SocketSessionsFacade from "../../src/facades/socket-sessions-facade.js";

describe("SocketSessionsFacade", () => {
    let socketSessionsService;
    let facade;

    beforeEach(() => {
        socketSessionsService = { connect: vi.fn(), subscribe: vi.fn(), notify: vi.fn() };
        facade = new SocketSessionsFacade({ socketSessionsService });
    });

    it("should subscribe an authenticated socket to authorized entities", async () => {
        const authUser = { id: "user-id", roles: ["NET"] };
        const webSocket = {};
        await facade.subscribe({ authUser, entities: ["devices", "whitelist"], id: "session-id", webSocket });
        expect(socketSessionsService.connect).toHaveBeenCalledWith({ authUser, id: "session-id", webSocket });
        expect(socketSessionsService.subscribe).toHaveBeenCalledWith({ id: "session-id", webSocket, entities: ["devices", "whitelist"] });
    });

    it("should reject a subscription without its required role", async () => {
        await expect(facade.subscribe({
            authUser: { id: "user-id", roles: ["NET"] },
            entities: ["users"],
            id: "session-id",
            webSocket: {}
        })).rejects.toMatchObject({ code: "ACL_PERMISSION_DENIED" });
        expect(socketSessionsService.connect).not.toHaveBeenCalled();
    });

    it("should publish private entity changes for their owner", () => {
        facade.notify({ entity: "ftp", data: { dir: "files" }, ownerId: "user-id" });
        expect(socketSessionsService.notify).toHaveBeenCalledWith({ entity: "ftp", data: { dir: "files" }, ownerId: "user-id" });
    });
});
