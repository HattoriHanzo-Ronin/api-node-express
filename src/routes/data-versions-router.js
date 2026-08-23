import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createDataVersionsRouter({ dataVersionsController }) {
    const dataVersionsRouter = Router();

    dataVersionsRouter.get("/", asyncHandler(dataVersionsController.getById));

    return dataVersionsRouter;
}

const { asyncHandler } = Middlewares;
