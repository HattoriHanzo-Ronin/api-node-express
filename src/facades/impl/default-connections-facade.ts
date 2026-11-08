import type ConnectionsFacade from "../connections-facade.js";
import type { ConnectionsFacadeDependencies } from "../../types/connections/default-connections-facade.js";
import type { ConnectionsByDevicesParams } from "../../types/connections/connections-model.js";
import type { ConnectionsSourceParams, CreateConnectionsParams, UpdateConnectionsParams } from "../../types/connections/connections-facade.js";

/**
 * Default connections facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultConnectionsFacade<Transaction> implements ConnectionsFacade<Transaction> {
    constructor(private readonly dependencies: ConnectionsFacadeDependencies<Transaction>) {}

    async getByDevices({ devicesId }: ConnectionsByDevicesParams) {
        const source = await this.dependencies.connectionsService.getByDevices({ devicesId });
        return this.dependencies.connectionsMapper.connectionsByDeviceToDomain(source);
    }

    connectionsByDeviceToDomain({ source }: ConnectionsSourceParams) {
        return this.dependencies.connectionsMapper.connectionsByDeviceToDomain(source);
    }

    async createMany({ clientTx, deviceId, connections }: CreateConnectionsParams<Transaction>) {
        const source = await this.dependencies.connectionsService.createMany({
            clientTx,
            connections: this.dependencies.connectionsMapper.connectionsToPersistence({ deviceId, connections })
        });
        return this.dependencies.connectionsMapper.connectionsToDomain(source);
    }

    async update({ clientTx, deviceId, connections, oldConnections }: UpdateConnectionsParams<Transaction>) {
        const source = await this.dependencies.connectionsService.update({
            clientTx,
            connections: this.dependencies.connectionsMapper.connectionsToPersistence({ deviceId, connections }),
            oldConnections: this.dependencies.connectionsMapper.connectionsToPersistence({ deviceId, connections: oldConnections })
        });
        return Object.fromEntries(
            Object.entries(source).map(([key, result]) => [key, this.dependencies.connectionsMapper.connectionsToDomain(result)])
        );
    }
}
