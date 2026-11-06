import type { ConnectionData } from "./connections-model.js";

export type ConnectionsToPersistenceParams = { deviceId: string; connections: ConnectionData[] };
