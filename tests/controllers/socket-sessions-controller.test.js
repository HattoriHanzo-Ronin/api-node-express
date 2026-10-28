import { beforeEach, describe, expect, it, vi } from "vitest";
import SocketSessionsController from "../../src/controllers/socket-sessions-controller.js";

describe("SocketSessionsController", () => {
    const authUser = { id: "550e8400-e29b-41d4-a716-446655440000" };
    let socketSessionsFacade;
    let controller;
    let req;
    let res;

    beforeEach(() => {
        socketSessionsFacade = { create: vi.fn(), refresh: vi.fn(), close: vi.fn() };
        controller = new SocketSessionsController({ socketSessionsFacade });
        req = { params: {}, user: authUser };
        res = { json: vi.fn(), status: vi.fn().mockReturnThis(), end: vi.fn() };
    });

    it("should create a session for the authenticated user", async () => {
        socketSessionsFacade.create.mockReturnValue({ id: "session-id" });
        await controller.create(req, res);
        expect(socketSessionsFacade.create).toHaveBeenCalledWith({ authUser });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ id: "session-id" });
    });

    it("should refresh an owned session", async () => {
        req.params = { id: "550e8400-e29b-41d4-a716-446655440000" };
        socketSessionsFacade.refresh.mockReturnValue({ id: req.params.id });
        await controller.refresh(req, res);
        expect(socketSessionsFacade.refresh).toHaveBeenCalledWith({ authUser, id: req.params.id });
    });

    it("should close an owned session", async () => {
        req.params = { id: "550e8400-e29b-41d4-a716-446655440000" };
        await controller.close(req, res);
        expect(socketSessionsFacade.close).toHaveBeenCalledWith({ authUser, id: req.params.id });
        expect(res.status).toHaveBeenCalledWith(204);
    });
});
