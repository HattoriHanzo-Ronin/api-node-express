import type { RequestHandler } from "express";
import type SocketSessionsController from "../controllers/socket-sessions-controller.js";

export type SocketSessionsRouterDependencies = {
    socketSessionsController: SocketSessionsController;
    requireAuth: RequestHandler;
};
