/**
 * Connections facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class ConnectionsFacade {
    constructor({ connectionsService, connectionsMapper }) {
        this.connectionsService = connectionsService;
        this.connectionsMapper = connectionsMapper;
    }

    /**
     * Returns device connections
     *
     * @param {string[]} params.devicesId Device identifiers
     * @returns {Promise<Map<string, Object[]>>} Domain connections by device identifier
     */
    async getByDevices({ devicesId }) {
        const source = await this.connectionsService.getByDevices({ devicesId });
        return this.connectionsMapper.connectionsByDeviceToDomain(source);
    }

    /**
     * Groups persistence connections by device and maps them to the domain model
     *
     * @param {Object[]} params.source Persistence connections
     * @returns {Map<string, Object[]>} Domain connections by device identifier
     */
    connectionsByDeviceToDomain({ source }) {
        return this.connectionsMapper.connectionsByDeviceToDomain(source);
    }

    /**
     * Creates device connections
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {string} params.deviceId Device identifier
     * @param {Object[]} params.connections Domain connections
     * @returns {Promise<Object[]>} Created connections
     */
    async createMany({ clientTx, deviceId, connections }) {
        const source = await this.connectionsService.createMany({
            clientTx,
            connections: this.connectionsMapper.connectionsToPersistence({ deviceId, connections })
        });
        return this.connectionsMapper.connectionsToDomain(source);
    }

    /**
     * Updates device connections
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {string} params.deviceId Device identifier
     * @param {Object[]} params.connections Domain connections
     * @param {Object[]} params.oldConnections Domain connections
     * @returns {Promise<Object>} Updated connections
     */
    async update({ clientTx, deviceId, connections, oldConnections }) {
        const source = await this.connectionsService.update({
            clientTx,
            connections: this.connectionsMapper.connectionsToPersistence({ deviceId, connections }),
            oldConnections: this.connectionsMapper.connectionsToPersistence({ deviceId, connections: oldConnections })
        });
        return Object.fromEntries(
            Object.entries(source).map(([key, result]) => [key, this.connectionsMapper.connectionsToDomain(result)])
        );
    }
}
