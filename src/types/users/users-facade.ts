import type { UserBasicInfo, UserId, UserInsert, UserUpdate } from "./users-model.js";
import type { UserAcl } from "../user-roles/user-roles-mapper.js";
import type { MappedUser } from "./users-mapper.js";
import type { AuthUserParams } from "../auth/auth-facade.js";

export type UserResponse = MappedUser | UserBasicInfo;
export type CreateUser = UserInsert & Partial<UserAcl>;
export type UpdateUser = UserId & UserUpdate & Partial<UserAcl>;
export type GetUserParams = Partial<AuthUserParams> & UserId;
export type GetUserWithoutAuthParams = { authUser?: never; id: string };
export type CreateUserParams = AuthUserParams & { user: CreateUser };
export type UpdateUserParams = AuthUserParams & { data: UpdateUser; changePassword?: boolean };
export type ChangePasswordParams = AuthUserParams & { currentPassword: string; newPassword: string };
export type UsersResponse = { version: string; data: UserResponse[] };
export type UpdatedUserResponse =
    UserResponse | Pick<UserBasicInfo, "username"> | (Partial<UserBasicInfo> & Partial<UserAcl>) | null;
