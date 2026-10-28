import { Router } from "express";
import { USER_ROLE } from "../config/constants.js";

const { admin } = USER_ROLE;
import Middlewares from "../middlewares/middlewares.js";

export default function createUsersRouter({ usersController, requireAuth }) {
    const router = Router();
    const { asyncHandler, authorizedRoles } = Middlewares;

    router.get("/", requireAuth, authorizedRoles([admin]), asyncHandler(usersController.getAll));
    router.get("/:id", requireAuth, authorizedRoles([admin]), asyncHandler(usersController.getById));

    router.post("/", requireAuth, authorizedRoles([admin]), asyncHandler(usersController.create));

    router.delete("/:id", requireAuth, authorizedRoles([admin]), asyncHandler(usersController.delete));

    router.patch("/password", requireAuth, asyncHandler(usersController.changePassword));

    router.put("/", requireAuth, asyncHandler(usersController.update));
    router.patch("/", requireAuth, asyncHandler(usersController.update));

    return router;
}
