import { Router } from "express";
import { USER_ROLE } from "../config/constants.js";
import Middlewares from "../middlewares/middlewares.js";

export default function createDataVersionsRouter({ dataVersionsController, requireAuth }) {
    const dataVersionsRouter = Router();

    dataVersionsRouter.get("/", requireAuth, asyncHandler(dataVersionsController.getById));
    dataVersionsRouter.get("/ftp", requireAuth, authorizedRoles([ftp]), asyncHandler(dataVersionsController.getFtp));

    return dataVersionsRouter;
}

const { ftp } = USER_ROLE;
const { asyncHandler, authorizedRoles } = Middlewares;
