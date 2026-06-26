import express from "express";
import "dotenv/config";
import Middlewares from "./middlewares/middlewares.js";
import createFtpRouter from "./routes/ftp-router.js";
import createWhitelistRouter from "./routes/whitelist-router.js";
import createDevicesRouter from "./routes/devices-router.js";
import createUsersRouter from "./routes/users-router.js";
import createAuthRouter from "./routes/auth-router.js";
import ApiError from "./utils/api-error.js";

export function createApp({ ftpController, whitelistController, devicesController, usersController, authController }) {
    const app = express();
    const { cors, json, errorHandler, requireAuth, authorizedRoles } = Middlewares;
    const PORT = process.env.PORT;

    app.disable("x-powered-by");

    app.use(cors(), json());

    app.use("/auth", createAuthRouter({ authController }));

    app.use(requireAuth);

    app.use("/ftp", authorizedRoles(["FTP"]), createFtpRouter({ ftpController }));
    app.use("/whitelist", authorizedRoles(["NET"]), createWhitelistRouter({ whitelistController }));
    app.use("/devices", authorizedRoles(["NET"]), createDevicesRouter({ devicesController }));
    app.use("/users", createUsersRouter({ usersController }));

    app.use((req, res, next) => {
        next(new ApiError({ message: "Page not found", status: 404, code: "ROUTE_NOT_FOUND" }));
    });
    app.use(errorHandler);

    app.listen(PORT);
}
