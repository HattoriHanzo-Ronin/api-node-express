import express from "express";
import Response from "./utils/response-utils.js";
import createNetRouter from "./routes/net-router.js";
import Middlewares from "./middlewares/middlewares.js";
import createFtpRouter from "./routes/ftp-router.js";
import "dotenv/config";

export function createApp({ devModel, ftpModel }) {
    const app = express();
    const PORT = process.env.PORT;

    app.disable("x-powered-by");

    app.use(Middlewares.cors(), Middlewares.json());

    app.use("/net", createNetRouter({ devModel }));

    app.use("/ftp", createFtpRouter({ ftpModel }));

    app.use((req, res) => {
        new Response({ res }).notFound();
    });

    app.listen(PORT);
}
