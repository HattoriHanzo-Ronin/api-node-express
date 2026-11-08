import type { RequestHandler } from "express";
import type AuthController from "../../controllers/auth-controller.js";

export type AuthRouterDependencies = { authController: AuthController; requireAuth: RequestHandler };
