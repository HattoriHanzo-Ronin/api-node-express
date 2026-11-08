import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { USER_ROLE } from "../../src/config/constants.js";
import SocketSessionsFacade from "../../src/facades/impl/default-socket-sessions-facade.js";

const createServiceMock = () => ({
    connect: vi.fn(),
    subscribe: vi.fn(),
    notify: vi.fn(),
    create: vi.fn(),
    refresh: vi.fn(),
    disconnect: vi.fn(),
    close: vi.fn(),
    invalidate: vi.fn(),
    closeAll: vi.fn()
});

describe("SocketSessionsFacade", () => {
    let socketSessionsService: ReturnType<typeof createServiceMock>;
    let facade: SocketSessionsFacade;

    beforeEach(() => {
        socketSessionsService = createServiceMock();
        facade = new SocketSessionsFacade({ socketSessionsService });
    });

    it("should subscribe an authenticated socket to authorized entities", async () => {
        const authUser = { id: "user-id", roles: [USER_ROLE.net], iat: 1_800_000_000, exp: 1_900_000_000 };
        const webSocket = {} as WebSocket;
        await facade.subscribe({ authUser, entities: ["devices", "whitelist"], id: "session-id", webSocket });
        expect(socketSessionsService.connect).toHaveBeenCalledWith({ authUser, id: "session-id", webSocket });
        expect(socketSessionsService.subscribe).toHaveBeenCalledWith({
            id: "session-id",
            webSocket,
            entities: ["devices", "whitelist"]
        });
    });

    it("should reject a subscription without its required role", async () => {
        await expect(
            facade.subscribe({
                authUser: { id: "user-id", roles: [USER_ROLE.net], iat: 1_800_000_000, exp: 1_900_000_000 },
                entities: ["users"],
                id: "session-id",
                webSocket: {} as WebSocket
            })
        ).rejects.toMatchObject({ code: "ACL_PERMISSION_DENIED" });
        expect(socketSessionsService.connect).not.toHaveBeenCalled();
    });

    it("should publish private entity changes for their owner", () => {
        facade.notify({ entity: "ftp", data: { dir: "files" }, ownerId: "user-id" });
        expect(socketSessionsService.notify).toHaveBeenCalledWith({
            entity: "ftp",
            data: { dir: "files" },
            ownerId: "user-id"
        });
    });
});
