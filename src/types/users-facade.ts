import type { UserBasicInfo, UserCredentials, UserId, UserInsert, UserUpdate } from "./users-model.js";
import type { UserAcl } from "./user-roles-facade.js";
import type { AuthAccessTokenPayload } from "./auth.js";

export type User = UserBasicInfo & UserAcl;
export type UserResponse = User | UserBasicInfo;
export type AuthenticatedUser = Pick<User, "id" | "username" | "roles" | "scope">;
export type CreateUser = UserInsert & Partial<UserAcl>;
export type UpdateUser = UserId & UserUpdate & Partial<UserAcl>;
export type AuthUserParams = { authUser: AuthAccessTokenPayload };
export type GetUserParams = { authUser?: AuthAccessTokenPayload; id: string };
export type GetUserWithoutAuthParams = { authUser?: never; id: string };
export type CreateUserParams = AuthUserParams & { user: CreateUser };
export type UpdateUserParams = AuthUserParams & { data: UpdateUser; changePassword?: boolean };
export type ChangePasswordParams = AuthUserParams & { currentPassword: string; newPassword: string };
export type UsersResponse = { version: string; data: UserResponse[] };
export type UpdatedUserResponse =
    | UserResponse
    | Pick<UserBasicInfo, "username">
    | (Partial<UserBasicInfo> & Partial<UserAcl>)
    | null;
export type AuthenticatedUserResponse = Pick<UserBasicInfo, "id" | "username"> & UserAcl;
export type UserCredentialsParams = UserCredentials;
