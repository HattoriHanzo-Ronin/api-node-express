import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createWhitelistRouter({ whitelistController }) {
    const whitelistRouter = Router();

    whitelistRouter.post("/:id", asyncHandler(whitelistController.create));

    whitelistRouter.delete("/:id", asyncHandler(whitelistController.delete));

    return whitelistRouter;
}

const { asyncHandler } = Middlewares;
