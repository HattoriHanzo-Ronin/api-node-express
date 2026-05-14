import express from "express"
import Response from "./utils/ResponseUtils.js"
import createNetRouter from "./routes/net.js"
import * as middlewares from "./middlewares/middWare.js"
import createFtpRouter from "./routes/ftp.js"
import "dotenv/config";

export function createApp({ devModel, ftpModel }) {

    const app = express(), PORT = process.env.PORT
  
    app.disable("x-powered-by")

    app.use(middlewares.corsMidd(), middlewares.jsonMidd())
    
    app.use("/net", createNetRouter({ devModel }))

    app.use("/ftp", createFtpRouter( { ftpModel } ))
    
    app.use((req, res) => {
        new Response({ res }).notFound()
    })

    app.listen(PORT)
}