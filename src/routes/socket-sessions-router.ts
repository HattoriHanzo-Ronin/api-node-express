import type { SocketSessionsRouterDependencies } from "../types/socket-sessions/socket-sessions-router.js";
import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createSocketSessionsRouter({
    socketSessionsController,
    requireAuth
}: SocketSessionsRouterDependencies) {
    const socketSessionsRouter = Router();
    const { asyncHandler, routeNotFound } = Middlewares;

    socketSessionsRouter.post("/", requireAuth, asyncHandler(socketSessionsController.create));
    socketSessionsRouter.post("/:id/refresh", requireAuth, asyncHandler(socketSessionsController.refresh));

    socketSessionsRouter.delete("/:id", requireAuth, asyncHandler(socketSessionsController.close));

    socketSessionsRouter.use(routeNotFound);

    return socketSessionsRouter;
}
