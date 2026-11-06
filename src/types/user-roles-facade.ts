import type { Role } from "./user-roles-model.js";

export type UserAcl = { roles: Role[]; scope?: Role[] };

export type UserRolesWriteParams<Transaction> = {
    clientTx: Transaction;
    userId: string;
    roles?: Role[];
    scope?: Role[];
};
