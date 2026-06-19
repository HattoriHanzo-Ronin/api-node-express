import express from "express";
import "dotenv/config";
import Middlewares from "./middlewares/middlewares.js";
import createFtpRouter from "./routes/ftp-router.js";
import createWhitelistRouter from "./routes/whitelist-router.js";
import createDeviceRouter from "./routes/device-router.js";
import createUsersRouter from "./routes/users-router.js";
import createAuthRouter from "./routes/auth-router.js";
import ValidateUtils from "./utils/validate-utils.js";
import ApiError from "./utils/api-error.js";

export function createApp({ ftpController, whitelistController, deviceController, usersController, authController }) {
    const app = express();
    const { cors, json, errorHandler, requireAuth, authorizedRoles } = Middlewares;
    const PORT = process.env.PORT;

    app.disable("x-powered-by");

    app.use(cors(), json());

    app.use("/auth", createAuthRouter({ authController }));

    app.use(requireAuth);

    app.use("/ftp", authorizedRoles(["FTP"]), createFtpRouter({ ftpController }));
    app.use("/whitelist", authorizedRoles(["NET_ADMIN"]), createWhitelistRouter({ whitelistController }));
    app.use("/device", authorizedRoles(["NET_ADMIN"]), createDeviceRouter({ deviceController }));
    app.use("/users", createUsersRouter({ usersController }));

    app.use((req, res, next) => next(new ApiError("Page not found", 404)));
    app.use(errorHandler);

    app.listen(PORT);
}
