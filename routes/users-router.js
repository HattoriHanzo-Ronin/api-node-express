import { Router } from "express";
import Middlewares from "../middlewares/middlewares.js";

export default function createUsersRouter({ usersController }) {
    const router = Router();
    const { asyncHandler, authorizedRoles } = Middlewares;

    router.get("/", authorizedRoles(["ADMIN"]), asyncHandler(usersController.getAll));
    router.get("/:id", authorizedRoles(["ADMIN"]), asyncHandler(usersController.getById));

    router.post("/", authorizedRoles(["ADMIN"]), asyncHandler(usersController.create));
    
    router.delete("/:id", authorizedRoles(["ADMIN"]), asyncHandler(usersController.delete));

    router.put("/", asyncHandler(usersController.update));
    router.patch("/", asyncHandler(usersController.update));

    return router;
}
