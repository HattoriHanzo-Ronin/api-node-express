import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";
import { USER_ROLE } from "../config/constants.js";
import { ENV } from "../config/environment.js";

export default function createFtpRouter({ ftpController }) {
    const router = Router();

    router.get("/media/:id", cors([ENV.thumbnailGeneratorUrl]), asyncHandler(ftpController.streamMedia));

    router.get("/", requireAuth, authorizedRoles([ftp]), asyncHandler(ftpController.dir));
    router.get("/thumbnail/:name", requireAuth, authorizedRoles([ftp]), asyncHandler(ftpController.getThumbnail));

    router.post("/mkdir", requireAuth, authorizedRoles([ftp]), asyncHandler(ftpController.makeDir));
    router.post("/move", requireAuth, authorizedRoles([ftp]), asyncHandler(ftpController.move));
    router.post("/rename", requireAuth, authorizedRoles([ftp]), asyncHandler(ftpController.rename));
    router.post("/uploads", requireAuth, authorizedRoles([ftp]), asyncHandler(ftpController.createUpload));
    router.put("/uploads/:id/entries", requireAuth, authorizedRoles([ftp]), multipart(), asyncHandler(ftpController.uploadEntry));
    router.post("/uploads/:id/complete", requireAuth, authorizedRoles([ftp]), asyncHandler(ftpController.completeUpload));
    router.delete("/uploads/:id", requireAuth, authorizedRoles([ftp]), asyncHandler(ftpController.cancelTransfer));
    router.post("/downloads", requireAuth, authorizedRoles([ftp]), asyncHandler(ftpController.createDownload));
    router.get("/downloads/:id/entries", requireAuth, authorizedRoles([ftp]), asyncHandler(ftpController.downloadEntry));
    router.delete("/downloads/:id", requireAuth, authorizedRoles([ftp]), asyncHandler(ftpController.cancelTransfer));

    router.delete("/", requireAuth, authorizedRoles([ftp]), asyncHandler(ftpController.delete));

    return router;
}

const { ftp } = USER_ROLE;
const { asyncHandler, authorizedRoles, cors, multipart, requireAuth } = Middlewares;
