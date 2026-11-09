import type { ConnectionData, ConnectionsByDevicesParams } from "../types/connections/connections-model.js";
import type {
    ConnectionsSourceParams,
    ConnectionsUpdateResult,
    CreateConnectionsParams,
    UpdateConnectionsParams
} from "../types/connections/connections-facade.js";

export default interface ConnectionsFacade<Transaction> {
    /**
     * Returns connections by device identifier
     *
     * @param params.devicesId Device identifiers
     * @returns Connections by device
     */
    getByDevices(params: ConnectionsByDevicesParams): Promise<Map<string, ConnectionData[]>>;

    /**
     * Maps connections by device identifier
     *
     * @param params.source Persistence connections
     * @returns Connections by device
     */
    connectionsByDeviceToDomain(params: ConnectionsSourceParams): Map<string, ConnectionData[]>;

    /**
     * Creates device connections
     *
     * @param params.clientTx Transaction client
     * @param params.deviceId Device identifier
     * @param params.connections Device connections
     * @returns Created connections
     */
    createMany(params: CreateConnectionsParams<Transaction>): Promise<ConnectionData[]>;

    /**
     * Updates device connections
     *
     * @param params.clientTx Transaction client
     * @param params.deviceId Device identifier
     * @param params.connections Device connections
     * @param params.oldConnections Current connections
     * @returns Updated connections
     */
    update(params: UpdateConnectionsParams<Transaction>): Promise<ConnectionsUpdateResult>;
}
