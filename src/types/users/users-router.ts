import type { RequestHandler } from "express";
import type UsersController from "../../controllers/users-controller.js";

export type UsersRouterDependencies = { usersController: UsersController; requireAuth: RequestHandler };
