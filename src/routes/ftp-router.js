import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";
import { USER_ROLE } from "../config/constants.js";
import { ENV } from "../config/environment.js";

export default function createFtpRouter({ ftpController }) {
    const router = Router();

    router.get("/media/:id", cors([ENV.thumbnailGeneratorUrl]), asyncHandler(ftpController.streamMedia));

    router.use(requireAuth, authorizedRoles([ftp]));

    router.get("/", asyncHandler(ftpController.dir));
    router.get("/thumbnail/:name", asyncHandler(ftpController.getThumbnail));

    router.post("/mkdir", asyncHandler(ftpController.makeDir));
    router.post("/move", asyncHandler(ftpController.move));
    router.post("/rename", asyncHandler(ftpController.rename));
    router.post("/upload", multipart(), asyncHandler(ftpController.upload));
    router.post("/download", asyncHandler(ftpController.download));

    router.delete("/", asyncHandler(ftpController.delete));

    return router;
}

const { ftp } = USER_ROLE;
const { asyncHandler, authorizedRoles, cors, multipart, requireAuth } = Middlewares;
