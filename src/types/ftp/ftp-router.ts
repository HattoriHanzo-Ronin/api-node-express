import type { RequestHandler } from "express";
import type FtpController from "../../controllers/ftp-controller.js";

export type FtpRouterDependencies = { ftpController: FtpController; requireAuth: RequestHandler };
