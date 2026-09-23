import { Router } from "express";
import { USER_ROLE } from "../config/constants.js";
import Middlewares from "../middlewares/middlewares.js";

export default function createDataVersionsRouter({ dataVersionsController }) {
    const dataVersionsRouter = Router();

    dataVersionsRouter.get("/", asyncHandler(dataVersionsController.getById));
    dataVersionsRouter.get("/ftp", authorizedRoles([ftp]), asyncHandler(dataVersionsController.getFtp));

    return dataVersionsRouter;
}

const { ftp } = USER_ROLE;
const { asyncHandler, authorizedRoles } = Middlewares;
