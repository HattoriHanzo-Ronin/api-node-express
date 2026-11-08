import type { UserAclByUser } from "../user-roles/user-roles-facade.js";
import type { UserAcl } from "../user-roles/user-roles-mapper.js";
import type { UserAuthentication, UserBasicInfo } from "./users-model.js";

export type UserIdentity = Pick<UserAuthentication, "id" | "username">;
export type UserMapperParams = { source: UserBasicInfo; acl: UserAcl };
export type UserIdentityMapperParams = { source: UserIdentity; acl: UserAcl };
export type UsersMapperParams = { users: UserBasicInfo[]; aclByUser: UserAclByUser };
export type MappedUser = UserBasicInfo & UserAcl;
export type MappedUserIdentity = UserIdentity & UserAcl;
