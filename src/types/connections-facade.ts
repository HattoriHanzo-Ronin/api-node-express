import type { Connection, ConnectionData } from "./connections-model.js";
import type { ConnectionsToPersistenceParams } from "./connections-mapper.js";
import type { ConnectionsUpdateResult as PersistenceUpdateResult } from "./connections-service.js";

export type ConnectionsSourceParams = { source: Connection[] };
export type CreateConnectionsParams<Transaction> = ConnectionsToPersistenceParams & { clientTx: Transaction };
export type UpdateConnectionsParams<Transaction> = CreateConnectionsParams<Transaction> & { oldConnections: ConnectionData[] };

export type ConnectionsUpdateResult = { [Key in keyof PersistenceUpdateResult]: ConnectionData[] };
