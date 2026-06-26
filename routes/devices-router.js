import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createDevicesRouter({ devicesController }) {
    const devicesRouter = Router();

    devicesRouter.get("/", asyncHandler(devicesController.getAll));
    devicesRouter.get("/allowed/:id", asyncHandler(devicesController.getAllowedDevices));
    devicesRouter.get("/notallowed/:id", asyncHandler(devicesController.getNotAllowedDevices));

    devicesRouter.post("/", asyncHandler(devicesController.create));

    devicesRouter.put("/", asyncHandler(devicesController.update));

    devicesRouter.delete("/:id", asyncHandler(devicesController.delete));

    return devicesRouter;
}

const { asyncHandler } = Middlewares;
