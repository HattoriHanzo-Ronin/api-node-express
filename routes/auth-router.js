import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createAuthRouter({ authController }) {
    const router = Router();
    const { asyncHandler, requireAuth } = Middlewares;

    router.post("/", asyncHandler(authController.login));
    router.post("/refresh", asyncHandler(authController.refresh));
    router.post("/logout", requireAuth, asyncHandler(authController.logout));

    return router;
}
