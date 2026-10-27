import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createThumbnailRouter({ thumbnailController }) {
    const router = Router();

    router.post("/:id", asyncHandler(thumbnailController.create));

    router.use(routeNotFound);

    return router;
}

const { asyncHandler, routeNotFound } = Middlewares;
