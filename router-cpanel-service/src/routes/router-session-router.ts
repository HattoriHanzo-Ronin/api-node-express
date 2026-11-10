import { Router } from "express";
import type { RouterSessionRouterDependencies } from "../types/router-session/router-session-router.js";
import Middlewares from "../middlewares/middlewares.js";

export default function createRouterSessionRouter({
    routerSessionController
}: RouterSessionRouterDependencies): Router {
    const router = Router();
    const { asyncHandler, routeNotFound } = Middlewares;

    router.post("/", asyncHandler(routerSessionController.create));
    router.post("/:sessionId/navigation", asyncHandler(routerSessionController.navigate));

    router.delete("/:sessionId", asyncHandler(routerSessionController.delete));

    router.use(routeNotFound);

    return router;
}
