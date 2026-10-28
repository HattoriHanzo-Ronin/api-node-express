import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createAuthRouter({ authController, requireAuth }) {
    const router = Router();
    const { asyncHandler, routeNotFound } = Middlewares;

    router.post("/", asyncHandler(authController.login));
    router.post("/refresh", asyncHandler(authController.refresh));

    router.delete("/", requireAuth, asyncHandler(authController.logout));

    router.use(routeNotFound);

    return router;
}
