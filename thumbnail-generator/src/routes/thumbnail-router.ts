import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";
import type { ThumbnailController } from "../controllers/thumbnail-controller.js";

export default function createThumbnailRouter({ thumbnailController }: { thumbnailController: ThumbnailController }): Router {
    const router = Router();
    const { asyncHandler, routeNotFound } = Middlewares;

    router.post<{ id: string }>("/:id", asyncHandler(thumbnailController.create));

    router.use(routeNotFound);

    return router;
}
