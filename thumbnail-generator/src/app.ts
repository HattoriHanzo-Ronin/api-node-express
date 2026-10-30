import express from "express";
import type { Express } from "express";
import Middlewares from "./middlewares/middlewares.js";
import createThumbnailRouter from "./routes/thumbnail-router.js";
import type { ThumbnailController } from "./controllers/thumbnail-controller.js";
import type { ExpressThumbnailControllerHandlers } from "./types/default-thumbnail-controller.js";

export function createApp({
    thumbnailController
}: {
    thumbnailController: ThumbnailController<ExpressThumbnailControllerHandlers>;
}): Express {
    const app = express();
    const { routeNotFound, errorHandler } = Middlewares;

    app.use("/thumbnail", createThumbnailRouter({ thumbnailController }));

    app.use(routeNotFound, errorHandler);

    return app;
}
