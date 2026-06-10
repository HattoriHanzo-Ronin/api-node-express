import express from "express";
import "dotenv/config";
import Middlewares from "./middlewares/middlewares.js";
import createFtpRouter from "./routes/ftp-router.js";
import createWhitelistRouter from "./routes/whitelist-router.js";
import createDeviceRouter from "./routes/device-router.js";
import ValidateUtils from "./utils/validate-utils.js";
import ApiError from "./utils/api-error.js";

export function createApp({ ftpController, whitelistController, deviceController }) {
    const app = express();
    const { cors, json, errorHandler, requireAuth } = Middlewares;
    const PORT = process.env.PORT;

    app.disable("x-powered-by");

    app.use(cors(), json());
    app.use(requireAuth);

    app.use("/ftp", createFtpRouter({ ftpController }));
    app.use("/whitelist", createWhitelistRouter({ whitelistController }));
    app.use("/device", createDeviceRouter({ deviceController }));

    app.use((req, res, next) => next(new ApiError("Page not found", 404)));
    app.use(errorHandler);

    app.listen(PORT);
}
