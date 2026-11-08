import type { DeleteUserRolesParams, InsertUserRolesParams } from "./user-roles-model.js";

export type CreateUserRolesParams<Transaction> = Omit<InsertUserRolesParams<Transaction>, "userRoles"> &
    Partial<Pick<InsertUserRolesParams<Transaction>, "userRoles">>;
export type ReplaceUserRolesParams<Transaction> = CreateUserRolesParams<Transaction> &
    DeleteUserRolesParams<Transaction>;
