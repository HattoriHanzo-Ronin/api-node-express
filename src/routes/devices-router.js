import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";
import { USER_ROLE } from "../config/constants.js";

export default function createDevicesRouter({ devicesController, requireAuth }) {
    const devicesRouter = Router();
    const { net } = USER_ROLE;
    const { asyncHandler, authorizedRoles, routeNotFound } = Middlewares;

    devicesRouter.get("/", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.getAll));
    devicesRouter.get("/allowed/:id", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.getAllowedDevices));
    devicesRouter.get("/notallowed/:id", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.getNotAllowedDevices));

    devicesRouter.post("/", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.create));
    devicesRouter.post("/:routerId/cpanel", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.createRouterCpanel));
    devicesRouter.post("/cpanel/:sessionId/navigation", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.navigateRouterCpanel));

    devicesRouter.put("/", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.update));

    devicesRouter.patch("/", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.update));

    devicesRouter.delete("/:id", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.delete));
    devicesRouter.delete("/cpanel/:sessionId", requireAuth, authorizedRoles([net]), asyncHandler(devicesController.closeRouterCpanel));

    devicesRouter.use(routeNotFound);

    return devicesRouter;
}
