import type RefreshTokensModel from "../models/refresh-tokens-model.js";
import type { PostgresError } from "./postgres-error.js";

export type RefreshTokensServiceDependencies = {
    refreshTokensModel: RefreshTokensModel;
    entityError: (error: PostgresError) => void;
};
