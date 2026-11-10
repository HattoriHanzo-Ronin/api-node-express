import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";
import type { ThumbnailRouterDependencies } from "../types/thumbnail/thumbnail-router.js";

export default function createThumbnailRouter({ thumbnailController }: ThumbnailRouterDependencies): Router {
    const router = Router();
    const { asyncHandler, routeNotFound } = Middlewares;

    router.post<{ id: string }>("/:id", asyncHandler(thumbnailController.create));

    router.use(routeNotFound);

    return router;
}
