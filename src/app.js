import express from "express";
import "dotenv/config";
import Middlewares from "./middlewares/middlewares.js";
import createDataVersionsRouter from "./routes/data-versions-router.js";
import createFtpRouter from "./routes/ftp-router.js";
import createWhitelistRouter from "./routes/whitelist-router.js";
import createDevicesRouter from "./routes/devices-router.js";
import createUsersRouter from "./routes/users-router.js";
import createAuthRouter from "./routes/auth-router.js";
import { ENV, USER_ROLE } from "./config/constants.js";

const { ftp, net } = USER_ROLE;

export function createApp({
    dataVersionsController,
    ftpController,
    whitelistController,
    devicesController,
    usersController,
    authController
}) {
    const app = express();
    const { cors, json, errorHandler, requireAuth, authorizedRoles, routeNotFound } = Middlewares;

    app.disable("x-powered-by");

    app.use(cors(), json());

    app.use("/auth", createAuthRouter({ authController }));

    app.use(requireAuth);

    app.use("/data-versions", createDataVersionsRouter({ dataVersionsController }));
    app.use("/ftp", authorizedRoles([ftp]), createFtpRouter({ ftpController }));
    app.use("/whitelist", authorizedRoles([net]), createWhitelistRouter({ whitelistController }));
    app.use("/devices", authorizedRoles([net]), createDevicesRouter({ devicesController }));
    app.use("/users", createUsersRouter({ usersController }));

    app.use(routeNotFound, errorHandler);

    app.listen(ENV.port);
}
