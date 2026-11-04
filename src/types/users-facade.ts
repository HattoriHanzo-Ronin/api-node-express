import type { UserBasicInfo } from "./users-model.js";
import type { Role } from "./user-roles-model.js";

export type UserAcl = {
    roles: Role[];
    scope?: Role[];
};

export type User = UserBasicInfo & UserAcl;

export type UserResponse = User | UserBasicInfo;

export type AuthenticatedUser = Pick<User, "id" | "username" | "roles" | "scope">;
