import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createThumbnailRouter({ thumbnailController }) {
    const router = Router();
    const { asyncHandler, routeNotFound } = Middlewares;

    router.post("/:id", asyncHandler(thumbnailController.create));

    router.use(routeNotFound);

    return router;
}
