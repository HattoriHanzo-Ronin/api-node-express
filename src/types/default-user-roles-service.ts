import type UserRolesModel from "../models/user-roles-model.js";

export type UserRolesServiceDependencies<Transaction> = { userRolesModel: UserRolesModel<Transaction> };
