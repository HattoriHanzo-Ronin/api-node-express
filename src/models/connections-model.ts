import type { Connection, ConnectionsByDevicesParams, DeleteConnectionsParams, WriteConnectionsParams } from "../types/connections/connections-model.js";

export default interface ConnectionsModel<Transaction> {
    /**
     * Returns connections associated with devices
     *
     * @param params.devicesId Device identifiers
     * @returns Connections
     */
    getByDevices(params: ConnectionsByDevicesParams): Promise<Connection[]>;

    /**
     * Inserts connections
     *
     * @param params.clientTx Transaction client
     * @param params.connections Connections
     * @returns Inserted connections
     */
    insertMany(params: WriteConnectionsParams<Transaction>): Promise<Connection[]>;

    /**
     * Updates connections
     *
     * @param params.clientTx Transaction client
     * @param params.connections Connections
     * @returns Updated connections
     */
    updateMany(params: WriteConnectionsParams<Transaction>): Promise<Connection[]>;

    /**
     * Deletes connections
     *
     * @param params.clientTx Transaction client
     * @param params.macs Connection MAC addresses
     * @returns Deleted connections
     */
    deleteMany(params: DeleteConnectionsParams<Transaction>): Promise<Connection[]>;
}
