/**
 * Connections facade
 *
 * @author HattoriHanzo-Ronin
 * @template Transaction
 */
export default class ConnectionsFacade {
    #connectionsService;
    #connectionsMapper;

    constructor({ connectionsService, connectionsMapper }) {
        this.#connectionsService = connectionsService;
        this.#connectionsMapper = connectionsMapper;
    }

    /**
     * Returns device connections
     *
     * @param {import("../types/connections-facade.js").ConnectionsByDevicesParams} params Device identifiers
     * @returns {Promise<Map<string, import("../types/connections-model.js").ConnectionData[]>>} Domain connections by device identifier
     */
    async getByDevices({ devicesId }) {
        const source = await this.#connectionsService.getByDevices({ devicesId });
        return this.#connectionsMapper.connectionsByDeviceToDomain(source);
    }

    /**
     * Groups persistence connections by device and maps them to the domain model
     *
     * @param {import("../types/connections-facade.js").ConnectionsSourceParams} params Persistence connections
     * @returns {Map<string, import("../types/connections-model.js").ConnectionData[]>} Domain connections by device identifier
     */
    connectionsByDeviceToDomain({ source }) {
        return this.#connectionsMapper.connectionsByDeviceToDomain(source);
    }

    /**
     * Creates device connections
     *
     * @param {import("../types/connections-facade.js").CreateConnectionsParams<Transaction>} params Device connections
     * @returns {Promise<import("../types/connections-model.js").ConnectionData[]>} Created connections
     */
    async createMany({ clientTx, deviceId, connections }) {
        const source = await this.#connectionsService.createMany({
            clientTx,
            connections: this.#connectionsMapper.connectionsToPersistence({ deviceId, connections })
        });
        return this.#connectionsMapper.connectionsToDomain(source);
    }

    /**
     * Updates device connections
     *
     * @param {import("../types/connections-facade.js").UpdateConnectionsParams<Transaction>} params Device connections
     * @returns {Promise<import("../types/connections-facade.js").ConnectionsUpdateResult>} Updated connections
     */
    async update({ clientTx, deviceId, connections, oldConnections }) {
        const source = await this.#connectionsService.update({
            clientTx,
            connections: this.#connectionsMapper.connectionsToPersistence({ deviceId, connections }),
            oldConnections: this.#connectionsMapper.connectionsToPersistence({ deviceId, connections: oldConnections })
        });
        return Object.fromEntries(
            Object.entries(source).map(([key, result]) => [key, this.#connectionsMapper.connectionsToDomain(result)])
        );
    }
}
