import express from "express";
import type { Express } from "express";
import Middlewares from "./middlewares/middlewares.js";
import createThumbnailRouter from "./routes/thumbnail-router.js";
import type { ThumbnailRouterDependencies } from "./types/thumbnail/thumbnail-router.js";

export default function createApp({ thumbnailController }: ThumbnailRouterDependencies): Express {
    const app = express();
    const { routeNotFound, errorHandler } = Middlewares;

    app.use("/thumbnail", createThumbnailRouter({ thumbnailController }));

    app.use(routeNotFound, errorHandler);

    return app;
}
