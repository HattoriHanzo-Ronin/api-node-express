import type WhitelistModel from "../models/whitelist-model.js";
import type { PostgresError } from "./postgres-error.js";

export type WhitelistServiceDependencies<Transaction> = {
    whitelistModel: WhitelistModel<Transaction>;
    entityError: (error: PostgresError) => void;
};
