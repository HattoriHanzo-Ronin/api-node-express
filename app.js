import express from "express";
import "dotenv/config";
import Middlewares from "./middlewares/middlewares.js";
import createFtpRouter from "./routes/ftp-router.js";
import createWhitelistRouter from "./routes/whitelist-router.js";
import createDevicesRouter from "./routes/devices-router.js";
import createUsersRouter from "./routes/users-router.js";
import createAuthRouter from "./routes/auth-router.js";
import ApiError from "./utils/api-error.js";
import { API_ERROR, ENV, USER_ROLE } from "./config/constants.js";

const { ftp, net } = USER_ROLE;

export function createApp({ ftpController, whitelistController, devicesController, usersController, authController }) {
    const app = express();
    const { cors, json, errorHandler, requireAuth, authorizedRoles } = Middlewares;

    app.disable("x-powered-by");

    app.use(cors(), json());

    app.use("/auth", createAuthRouter({ authController }));

    app.use(requireAuth);

    app.use("/ftp", authorizedRoles([ftp]), createFtpRouter({ ftpController }));
    app.use("/whitelist", authorizedRoles([net]), createWhitelistRouter({ whitelistController }));
    app.use("/devices", authorizedRoles([net]), createDevicesRouter({ devicesController }));
    app.use("/users", createUsersRouter({ usersController }));

    app.use((req, res, next) => {
        next(new ApiError({ message: "Page not found", status: 404, apiError: API_ERROR.routeNotFound }));
    });
    app.use(errorHandler);

    app.listen(ENV.port);
}
