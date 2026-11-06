import type { CONNECTION_TYPE } from "../config/constants.js";

export type ConnectionType = (typeof CONNECTION_TYPE)[keyof typeof CONNECTION_TYPE];

export type Connection = {
    device_id: string;
    mac: string;
    ctype: ConnectionType;
};

export type ConnectionData = Omit<Connection, "device_id">;

export type RouterConnection = ConnectionData & {
    key: string | null;
};

export type ConnectionsByDevicesParams = { devicesId: string[] };
export type WriteConnectionsParams<Transaction> = { clientTx: Transaction; connections: Connection[] };
export type DeleteConnectionsParams<Transaction> = { clientTx: Transaction; macs: string[] };
