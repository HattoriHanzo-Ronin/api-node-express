import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createRouterSessionRouter({ routerSessionController }) {
    const router = Router();

    router.post("/", asyncHandler(routerSessionController.create));
    router.post("/:sessionId/navigation", asyncHandler(routerSessionController.navigate));

    router.delete("/:sessionId", asyncHandler(routerSessionController.delete));

    router.use(routeNotFound);

    return router;
}

const { asyncHandler, routeNotFound } = Middlewares;
