import type { RequestHandler } from "express";
import type DevicesController from "../controllers/devices-controller.js";

export type DevicesRouterDependencies = { devicesController: DevicesController; requireAuth: RequestHandler };
