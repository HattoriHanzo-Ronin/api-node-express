import express from "express";
import "dotenv/config";
import Middlewares from "./middlewares/middlewares.js";
import createFtpRouter from "./routes/ftp-router.js";
import createWhitelistRouter from "./routes/whitelist-router.js";

export function createApp({ ftpController, whitelistController }) {
    const app = express();
    const { cors, json } = Middlewares;
    const PORT = process.env.PORT;

    app.disable("x-powered-by");

    app.use(cors(), json());

    app.use("/ftp", createFtpRouter({ ftpController }));

    app.use("/whitelist", createWhitelistRouter({ whitelistController }));

    app.listen(PORT);
}
