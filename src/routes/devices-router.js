import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";
import { USER_ROLE } from "../config/constants.js";

export default function createDevicesRouter({ devicesController }) {
    const devicesRouter = Router();

    devicesRouter.get("/", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.getAll));
    devicesRouter.get("/allowed/:id", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.getAllowedDevices));
    devicesRouter.get("/notallowed/:id", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.getNotAllowedDevices));

    devicesRouter.post("/", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.create));

    devicesRouter.put("/", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.update));

    devicesRouter.delete("/:id", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.delete));

    return devicesRouter;
}

const { net } = USER_ROLE;
const { asyncHandler, authorizedRoles, requireAuth } = Middlewares;
