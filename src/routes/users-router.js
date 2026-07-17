import { Router } from "express";
import { USER_ROLE } from "../config/constants.js";

const { admin } = USER_ROLE;
import Middlewares from "../middlewares/middlewares.js";

export default function createUsersRouter({ usersController }) {
    const router = Router();
    const { asyncHandler, authorizedRoles } = Middlewares;

    router.get("/", authorizedRoles([admin]), asyncHandler(usersController.getAll));
    router.get("/:id", authorizedRoles([admin]), asyncHandler(usersController.getById));

    router.post("/", authorizedRoles([admin]), asyncHandler(usersController.create));
    
    router.delete("/:id", authorizedRoles([admin]), asyncHandler(usersController.delete));

    router.put("/", asyncHandler(usersController.update));
    router.patch("/", asyncHandler(usersController.update));

    return router;
}
