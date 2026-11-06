import type { Connection, ConnectionData } from "./connections-model.js";

export type ConnectionsByDevicesParams = { devicesId: string[] };
export type ConnectionsSourceParams = { source: Connection[] };
export type CreateConnectionsParams<Transaction> = { clientTx: Transaction; deviceId: string; connections: ConnectionData[] };
export type UpdateConnectionsParams<Transaction> = CreateConnectionsParams<Transaction> & { oldConnections: ConnectionData[] };

export type ConnectionsUpdateResult = {
    deletedConnections?: ConnectionData[];
    createdConnections?: ConnectionData[];
    updatedConnections?: ConnectionData[];
};
