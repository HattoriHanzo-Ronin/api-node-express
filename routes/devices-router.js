import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createDevicesRouter({ devicesController }) {
    const devicesRouter = Router();

    devicesRouter.get("/", asyncHandler(devicesController.getAll));
    devicesRouter.get("/allow/:routerId", asyncHandler(devicesController.getAllowDevicess));
    devicesRouter.get("/notallow/:routerId", asyncHandler(devicesController.getNotAllowDevicess));

    devicesRouter.post("/", asyncHandler(devicesController.create));

    devicesRouter.put("/", asyncHandler(devicesController.update));

    devicesRouter.delete("/:id", asyncHandler(devicesController.delete));

    return devicesRouter;
}

const { asyncHandler } = Middlewares;
