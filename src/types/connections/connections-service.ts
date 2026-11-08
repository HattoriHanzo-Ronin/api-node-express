import type { Connection, WriteConnectionsParams } from "./connections-model.js";

export type UpdateConnectionsParams<Transaction> = WriteConnectionsParams<Transaction> & {
    oldConnections: Connection[];
};
export type ConnectionsUpdateResult = {
    deletedConnections?: Connection[];
    createdConnections?: Connection[];
    updatedConnections?: Connection[];
};
