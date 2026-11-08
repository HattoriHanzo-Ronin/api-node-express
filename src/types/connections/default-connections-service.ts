import type ConnectionsModel from "../../models/connections-model.js";
import type { PostgresError } from "../utils/postgres-error.js";

export type ConnectionsServiceDependencies<Transaction> = {
    connectionsModel: ConnectionsModel<Transaction>;
    entityError: (error: PostgresError) => void;
};
