import type { UserAcl, UserRolesMapperParams } from "./user-roles-mapper.js";

/** ACL data for the validated user identifiers supplied to the query */
export type UserAclByUser = Omit<Map<string, UserAcl>, "get"> & { get(userId: string): UserAcl };

export type UserRolesWriteParams<Transaction> = UserRolesMapperParams & { clientTx: Transaction };
