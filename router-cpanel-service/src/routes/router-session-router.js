import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createRouterSessionRouter({ routerSessionController }) {
    const router = Router();
    const { asyncHandler, routeNotFound } = Middlewares;

    router.post("/", asyncHandler(routerSessionController.create));
    router.post("/:sessionId/navigation", asyncHandler(routerSessionController.navigate));

    router.delete("/:sessionId", asyncHandler(routerSessionController.delete));

    router.use(routeNotFound);

    return router;
}
