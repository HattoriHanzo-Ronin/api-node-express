import { describe, expect, it, vi } from "vitest";
import RouterSessionController from "../../src/controllers/router-session-controller.js";

describe("RouterSessionController", () => {
    it("should pass the requested desktop client type to the session service", async () => {
        const routerSessionService = { create: vi.fn().mockResolvedValue({ id: "session-id" }) };
        const controller = new RouterSessionController({ routerSessionService });
        const res = { status: vi.fn(() => res), json: vi.fn() };
        await controller.create({ body: { ownerId: "user-id", routerName: "Router", routerIp: "192.168.1.1", routerPassword: "secret", language: "es-ES", clientType: "desktop", theme: "light" } }, res);
        expect(routerSessionService.create).toHaveBeenCalledWith({
            ownerId: "user-id",
            routerName: "Router",
            routerIp: "192.168.1.1",
            routerPassword: "secret",
            language: "es-ES",
            clientType: "desktop",
            theme: "light"
        });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ id: "session-id" });
    });

    it("should pass the requested mobile client type to the session service", async () => {
        const routerSessionService = { create: vi.fn().mockResolvedValue({ id: "session-id" }) };
        const controller = new RouterSessionController({ routerSessionService });
        const res = { status: vi.fn(() => res), json: vi.fn() };
        await controller.create({ body: { ownerId: "user-id", routerName: "Router", routerIp: "192.168.1.1", routerPassword: "secret", clientType: "mobile" } }, res);
        expect(routerSessionService.create).toHaveBeenCalledWith({
            ownerId: "user-id",
            routerName: "Router",
            routerIp: "192.168.1.1",
            routerPassword: "secret",
            language: undefined,
            clientType: "mobile",
            theme: undefined
        });
    });

    it("should navigate a router session", async () => {
        const routerSessionService = { navigate: vi.fn().mockResolvedValue() };
        const controller = new RouterSessionController({ routerSessionService });
        const res = { status: vi.fn(() => res), send: vi.fn() };
        await controller.navigate({ params: { sessionId: "session-id" }, body: { ownerId: "user-id", action: "back" } }, res);
        expect(routerSessionService.navigate).toHaveBeenCalledWith({ sessionId: "session-id", ownerId: "user-id", action: "back" });
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalledWith();
    });

    it("should close a router session for its owner", async () => {
        const routerSessionService = { close: vi.fn().mockResolvedValue() };
        const controller = new RouterSessionController({ routerSessionService });
        const res = { status: vi.fn(() => res), send: vi.fn() };
        await controller.delete({ params: { sessionId: "session-id" }, body: { ownerId: "user-id" } }, res);
        expect(routerSessionService.close).toHaveBeenCalledWith({ sessionId: "session-id", ownerId: "user-id" });
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalledWith();
    });
});
