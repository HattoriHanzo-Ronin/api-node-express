import { Router } from "express";
import type { RouterSessionController } from "../controllers/router-session-controller.js";
import type { ExpressRouterSessionControllerHandlers } from "../types/default-router-session-controller.js";
import Middlewares from "../middlewares/middlewares.js";

export default function createRouterSessionRouter({
    routerSessionController
}: {
    routerSessionController: RouterSessionController<ExpressRouterSessionControllerHandlers>;
}): Router {
    const router = Router();
    const { asyncHandler, routeNotFound } = Middlewares;

    router.post("/", asyncHandler(routerSessionController.create));
    router.post("/:sessionId/navigation", asyncHandler(routerSessionController.navigate));

    router.delete("/:sessionId", asyncHandler(routerSessionController.delete));

    router.use(routeNotFound);

    return router;
}
