import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createWhitelistRouter({ whitelistController }) {
    const whitelistRouter = Router();

    whitelistRouter.post("/", asyncHandler(whitelistController.create));

    whitelistRouter.delete("/", asyncHandler(whitelistController.delete));

    return whitelistRouter;
}

const { asyncHandler } = Middlewares;
