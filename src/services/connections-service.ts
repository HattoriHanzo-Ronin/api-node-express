import type {
    Connection,
    ConnectionsByDevicesParams,
    WriteConnectionsParams
} from "../types/connections/connections-model.js";
import type { ConnectionsUpdateResult, UpdateConnectionsParams } from "../types/connections/connections-service.js";

export default interface ConnectionsService<Transaction> {
    /**
     * Returns connections associated with devices
     *
     * @param params.devicesId Device identifiers
     * @returns Connections
     */
    getByDevices(params: ConnectionsByDevicesParams): Promise<Connection[]>;

    /**
     * Creates device connections
     *
     * @param params.clientTx Transaction client
     * @param params.connections Connections
     * @returns Created connections
     */
    createMany(params: WriteConnectionsParams<Transaction>): Promise<Connection[]>;

    /**
     * Updates device connections
     *
     * @param params.clientTx Transaction client
     * @param params.connections Connections
     * @param params.oldConnections Current connections
     * @returns Updated connections
     */
    update(params: UpdateConnectionsParams<Transaction>): Promise<ConnectionsUpdateResult>;
}
