import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createDeviceRouter({ deviceController }) {
    const deviceRouter = Router();

    deviceRouter.get("/", asyncHandler(deviceController.getAll));
    deviceRouter.get("/allow/:routerId", asyncHandler(deviceController.getAllowDevices));
    deviceRouter.get("/notallow/:routerId", asyncHandler(deviceController.getNotAllowDevices));

    deviceRouter.post("/", asyncHandler(deviceController.create));

    deviceRouter.put("/", asyncHandler(deviceController.update));

    deviceRouter.delete("/:id", asyncHandler(deviceController.delete));

    return deviceRouter;
}

const { asyncHandler } = Middlewares;
