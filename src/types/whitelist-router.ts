import type { RequestHandler } from "express";
import type WhitelistController from "../controllers/whitelist-controller.js";

export type WhitelistRouterDependencies = { whitelistController: WhitelistController; requireAuth: RequestHandler };
