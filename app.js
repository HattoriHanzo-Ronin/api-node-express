import express from "express";
import Middlewares from "./middlewares/middlewares.js";
import createFtpRouter from "./routes/ftp-router.js";
import "dotenv/config";

export function createApp({ ftpController }) {
    const app = express();
    const { cors, json } = Middlewares;
    const PORT = process.env.PORT;

    app.disable("x-powered-by");

    app.use(cors(), json());

    app.use("/ftp", createFtpRouter({ ftpController }));

    app.listen(PORT);
}
