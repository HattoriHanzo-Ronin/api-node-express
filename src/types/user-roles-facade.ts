import type { Role } from "./user-roles-model.js";

export type UserAcl = { roles: Role[]; scope?: Role[] };

/** ACL data for the validated user identifiers supplied to the query */
export type UserAclByUser = Omit<Map<string, UserAcl>, "get"> & { get(userId: string): UserAcl };

export type UserRolesWriteParams<Transaction> = {
    clientTx: Transaction;
    userId: string;
    roles?: Role[];
    scope?: Role[];
};
