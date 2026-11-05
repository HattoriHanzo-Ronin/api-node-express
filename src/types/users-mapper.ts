import type { UserAcl } from "./user-roles-facade.js";
import type { UserAuthentication, UserBasicInfo } from "./users-model.js";

export type UserIdentity = Pick<UserAuthentication, "id" | "username">;
export type UserMapperParams = { source: UserBasicInfo; acl?: UserAcl };
export type UserIdentityMapperParams = { source: UserIdentity; acl?: UserAcl };
export type UsersMapperParams = { users: UserBasicInfo[]; aclByUser: Map<string, UserAcl> };
export type MappedUser = UserBasicInfo & Partial<UserAcl>;
export type MappedUserIdentity = UserIdentity & Partial<UserAcl>;
