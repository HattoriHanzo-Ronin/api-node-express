import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import type { SocketSessionsFacadeDependencies } from "../../src/types/socket-sessions/default-socket-sessions-facade.js";
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
    let dataVersionsFacade: { getById: ReturnType<typeof vi.fn> };
    let facade: SocketSessionsFacade;

    beforeEach(() => {
        socketSessionsService = createServiceMock();
        dataVersionsFacade = { getById: vi.fn() };
        facade = new SocketSessionsFacade({
            socketSessionsService,
            dataVersionsFacade:
                dataVersionsFacade as unknown as SocketSessionsFacadeDependencies<WebSocket>["dataVersionsFacade"]
        });
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

    it("queries and publishes each requested entity version", async () => {
        dataVersionsFacade.getById.mockResolvedValue({ devices: "2", whitelist: "3" });
        await facade.notify({ entities: ["devices", "whitelist"] });
        expect(dataVersionsFacade.getById).toHaveBeenCalledWith({ id: ["devices", "whitelist"] });
        expect(socketSessionsService.notify).toHaveBeenCalledWith({ entity: "devices", data: { version: "2" } });
        expect(socketSessionsService.notify).toHaveBeenCalledWith({ entity: "whitelist", data: { version: "3" } });
    });

    it("queries and publishes a single entity version", async () => {
        dataVersionsFacade.getById.mockResolvedValue({ version: "4" });
        await facade.notify({ entities: ["users"] });
        expect(dataVersionsFacade.getById).toHaveBeenCalledWith({ id: "users" });
        expect(socketSessionsService.notify).toHaveBeenCalledWith({ entity: "users", data: { version: "4" } });
    });

    it("does nothing when no entities are requested", async () => {
        await facade.notify({ entities: [] });
        expect(dataVersionsFacade.getById).not.toHaveBeenCalled();
        expect(socketSessionsService.notify).not.toHaveBeenCalled();
    });

    it("propagates version lookup errors without publishing", async () => {
        const error = new Error("version lookup failed");
        dataVersionsFacade.getById.mockRejectedValue(error);
        await expect(facade.notify({ entities: ["users"] })).rejects.toBe(error);
        expect(socketSessionsService.notify).not.toHaveBeenCalled();
    });

    it("should publish private entity changes for their owner", () => {
        facade.notify({ entity: "ftp", data: { dir: "files" }, ownerId: "user-id" });
        expect(dataVersionsFacade.getById).not.toHaveBeenCalled();
        expect(socketSessionsService.notify).toHaveBeenCalledWith({
            entity: "ftp",
            data: { dir: "files" },
            ownerId: "user-id"
        });
    });
});
