import express from "express";
import "dotenv/config";
import Middlewares from "./middlewares/middlewares.js";
import createFtpRouter from "./routes/ftp-router.js";
import createWhitelistRouter from "./routes/whitelist-router.js";
import createDevicesRouter from "./routes/devices-router.js";
import createUsersRouter from "./routes/users-router.js";
import createAuthRouter from "./routes/auth-router.js";
import createSocketSessionsRouter from "./routes/socket-sessions-router.js";

export function createApp({
    ftpController,
    whitelistController,
    devicesController,
    usersController,
    authController,
    socketSessionsController,
    accessTokenProvider
}) {
    const app = express();
    const { json, errorHandler, routeNotFound, requireAuth: createRequireAuth } = Middlewares;
    const requireAuth = createRequireAuth({ accessTokenProvider });

    app.disable("x-powered-by");

    app.use(json());

    app.use("/auth", createAuthRouter({ authController, requireAuth }));
    app.use("/socket-sessions", createSocketSessionsRouter({ socketSessionsController, requireAuth }));
    app.use("/ftp", createFtpRouter({ ftpController, requireAuth }));

    app.use("/whitelist", createWhitelistRouter({ whitelistController, requireAuth }));
    app.use("/devices", createDevicesRouter({ devicesController, requireAuth }));
    app.use("/users", createUsersRouter({ usersController, requireAuth }));

    app.use(routeNotFound, errorHandler);

    return app;
}
