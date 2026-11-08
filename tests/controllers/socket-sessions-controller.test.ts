import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import SocketSessionsController from "../../src/controllers/socket-sessions-controller.js";

const NEXT: NextFunction = vi.fn();
const createFacadeMock = () => ({
    create: vi.fn(),
    refresh: vi.fn(),
    close: vi.fn(),
    subscribe: vi.fn(),
    notify: vi.fn(),
    disconnect: vi.fn(),
    invalidate: vi.fn(),
    closeAll: vi.fn()
});

describe("SocketSessionsController", () => {
    const authUser = { id: "550e8400-e29b-41d4-a716-446655440000" };
    let socketSessionsFacade: ReturnType<typeof createFacadeMock>;
    let controller: SocketSessionsController;
    let req: Request<{ id: string }>;
    let res: Response;

    beforeEach(() => {
        socketSessionsFacade = createFacadeMock();
        controller = new SocketSessionsController({ socketSessionsFacade });
        req = { params: {}, user: authUser } as unknown as typeof req;
        res = { json: vi.fn(), status: vi.fn().mockReturnThis(), end: vi.fn() } as unknown as Response;
    });

    it("should create a session for the authenticated user", async () => {
        socketSessionsFacade.create.mockReturnValue({ id: "session-id" });
        await controller.create(req, res, NEXT);
        expect(socketSessionsFacade.create).toHaveBeenCalledWith({ authUser });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ id: "session-id" });
    });

    it("should refresh an owned session", async () => {
        req.params = { id: "550e8400-e29b-41d4-a716-446655440000" };
        socketSessionsFacade.refresh.mockReturnValue({ id: req.params.id });
        await controller.refresh(req, res, NEXT);
        expect(socketSessionsFacade.refresh).toHaveBeenCalledWith({ authUser, id: req.params.id });
    });

    it("should close an owned session", async () => {
        req.params = { id: "550e8400-e29b-41d4-a716-446655440000" };
        await controller.close(req, res, NEXT);
        expect(socketSessionsFacade.close).toHaveBeenCalledWith({ authUser, id: req.params.id });
        expect(res.status).toHaveBeenCalledWith(204);
    });
});
