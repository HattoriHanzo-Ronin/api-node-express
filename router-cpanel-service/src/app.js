import { fileURLToPath } from "node:url";
import express from "express";
import Middlewares from "./middlewares/middlewares.js";
import createRouterSessionRouter from "./routes/router-session-router.js";

export function createApp({ routerSessionController }) {
    const app = express();
    const { url } = import.meta;
    const { asyncHandler, json, routeNotFound, errorHandler } = Middlewares;
    const noVncPath = fileURLToPath(new URL("../node_modules/@novnc/novnc", url));
    const viewerPath = fileURLToPath(new URL("../public", url));

    app.disable("x-powered-by");

    app.use(json());

    app.use("/noVNC", express.static(noVncPath));
    app.use("/viewer", express.static(viewerPath));
    app.use("/sessions", createRouterSessionRouter({ routerSessionController }));

    app.post("/vnc/:sessionId/interaction", asyncHandler(routerSessionController.markInteraction));

    app.get("/vnc/:sessionId/status", asyncHandler(routerSessionController.streamStatus));

    app.use(routeNotFound, errorHandler);

    return app;
}
