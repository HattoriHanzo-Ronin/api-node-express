import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createFtpRouter({ ftpController }) {
    const router = Router();

    router.get("/", asyncHandler(ftpController.dir));

    router.post("/mkdir", asyncHandler(ftpController.makeDir));
    router.post("/upload", mult().single("file"), asyncHandler(ftpController.upload));
    router.post("/download", asyncHandler(ftpController.download));

    router.delete("/:type", asyncHandler(ftpController.delete));

    return router;
}

const { asyncHandler, mult } = Middlewares;
