import type { Role } from "./user-roles-model.js";

export type UserAcl = { roles: Role[]; scope?: Role[] };
export type UserRolesMapperParams = Partial<UserAcl> & { userId: string };
