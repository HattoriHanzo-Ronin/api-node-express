import express from "express";
import cors from "cors";
import "dotenv/config";
import createThumbnailRouter from "./routes/thumbnail-router.js";
import { ENV } from "./config/environment.js";

export function createApp({ thumbnailController }) {
    const app = express();

    app.disable("x-powered-by");
    app.use(cors({
        origin: (origin, callback) => callback(origin === ENV.apiUrl ? null : new Error("No permitido"), true)
    }));
    app.use("/thumbnail", createThumbnailRouter({ thumbnailController }));
    app.use((error, req, res, next) => {
        if (res.headersSent) {
            next(error);
            return;
        }

        const status = error.status ?? 500;
        const message = status === 500 ? "No se pudo generar la miniatura" : error.message;
        res.status(status).json({ message });
    });

    app.listen(ENV.port);
}
