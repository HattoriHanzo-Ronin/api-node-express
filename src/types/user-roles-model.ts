import type { USER_ROLE } from "../config/constants.js";

export type Role = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export type UserRole = {
    user_id: string;
    role: Role;
    scope: string | null;
};

export type UsersByIdParams = { usersId: string[] };
export type InsertUserRolesParams<Transaction> = { clientTx: Transaction; userRoles: UserRole[] };
export type DeleteUserRolesParams<Transaction> = { clientTx: Transaction; userId: string };
export type ReplaceUserRolesParams<Transaction> = InsertUserRolesParams<Transaction> & DeleteUserRolesParams<Transaction>;
