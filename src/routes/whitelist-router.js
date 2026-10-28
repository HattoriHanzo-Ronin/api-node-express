import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";
import { USER_ROLE } from "../config/constants.js";

export default function createWhitelistRouter({ whitelistController, requireAuth }) {
    const whitelistRouter = Router();
    const { net } = USER_ROLE;
    const { asyncHandler, authorizedRoles, routeNotFound } = Middlewares;

    whitelistRouter.post("/:id", requireAuth, authorizedRoles([net]), asyncHandler(whitelistController.create));

    whitelistRouter.delete("/:id", requireAuth, authorizedRoles([net]), asyncHandler(whitelistController.delete));

    whitelistRouter.use(routeNotFound);

    return whitelistRouter;
}
