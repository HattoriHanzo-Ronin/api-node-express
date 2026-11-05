import type UsersModel from "../models/users-model.js";
import type { PostgresError } from "./postgres-error.js";

export type UsersServiceDependencies<Transaction> = {
    usersModel: UsersModel<Transaction>;
    entityError: (error: PostgresError) => void;
};

