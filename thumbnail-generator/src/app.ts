import express from "express";
import { ENV } from "./config/environment.js";
import Middlewares from "./middlewares/middlewares.js";
import createThumbnailRouter from "./routes/thumbnail-router.js";
import type { ThumbnailController } from "./controllers/thumbnail-controller.js";

export function createApp({ thumbnailController }: { thumbnailController: ThumbnailController }): void {
    const app = express();
    const { routeNotFound, errorHandler } = Middlewares;

    app.use("/thumbnail", createThumbnailRouter({ thumbnailController }));

    app.use(routeNotFound, errorHandler);

    app.listen(ENV.port);
}
