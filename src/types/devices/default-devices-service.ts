import type DevicesModel from "../../models/devices-model.js";
import type { PostgresError } from "../utils/postgres-error.js";

export type DevicesServiceDependencies<Transaction> = {
    devicesModel: DevicesModel<Transaction>;
    entityError: (error: PostgresError) => void;
};
