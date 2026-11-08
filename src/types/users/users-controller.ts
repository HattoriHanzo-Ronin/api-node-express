import type { RequestHandler } from "express";
import type {
    ChangePasswordParams,
    CreateUser,
    UpdatedUserResponse,
    UpdateUser,
    UserResponse
} from "./users-facade.js";
import type { UserId } from "./users-model.js";
import type UsersFacade from "../../facades/users-facade.js";

export type UsersControllerDependencies = { usersFacade: UsersFacade };

export type GetAllUsersHandler = RequestHandler<Record<string, never>, UserResponse[]>;
export type GetUserByIdHandler = RequestHandler<UserId, UserResponse>;
export type CreateUserHandler = RequestHandler<Record<string, never>, UserResponse, CreateUser>;
export type UpdateUserHandler = RequestHandler<Record<string, never>, UpdatedUserResponse, UpdateUser>;
export type ChangeUserPasswordHandler = RequestHandler<
    Record<string, never>,
    void,
    Omit<ChangePasswordParams, "authUser">
>;
export type DeleteUserHandler = RequestHandler<UserId, UserId | null>;
