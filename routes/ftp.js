import { Router } from "express";
import { FtpController } from "../controllers/ftp/ftp.js";
import { mult } from "../middlewares/middWare.js";

export default function createFtpRouter ({ ftpModel }) {

    const router = Router(), ftpController = new FtpController({ ftpModel })

    router.get("/", ftpController.dir)

    router.get("/download", ftpController.getFile)

    router.get("/download/:id", ftpController.getFile)

    router.post("/mkdir", ftpController.makeDir)

    router.post("/upload", mult().single("file"), ftpController.upload)

    router.post("/download", ftpController.download)

    router.delete("/:type", ftpController.delete)

    return router
}