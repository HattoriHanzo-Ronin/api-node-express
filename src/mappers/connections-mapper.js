/**
 * Maps connection data between domain and persistence representations
 *
 * @author HattoriHanzo-Ronin
 */
export default class ConnectionsMapper {
    /**
     * Maps persistence connections to the domain model
     *
     * @param {Object[]} source Persistence connections
     * @returns {Object[]} Domain connections
     */
    static connectionsToDomain(source) {
        return source.map(({ mac, ctype }) => ({ mac, ctype }));
    }

    /**
     * Groups persistence connections by device and maps them to the domain model
     *
     * @param {Object[]} source Persistence connections
     * @returns {Map<string, Object[]>} Domain connections by device identifier
     */
    static connectionsByDeviceToDomain(source) {
        const connectionsByDevice = new Map();
        for (const connection of source) {
            const { device_id: deviceId } = connection;
            const connections = connectionsByDevice.get(deviceId) ?? [];
            connections.push(connection);
            connectionsByDevice.set(deviceId, connections);
        }
        for (const [deviceId, connections] of connectionsByDevice) {
            connectionsByDevice.set(deviceId, ConnectionsMapper.connectionsToDomain(connections));
        }
        return connectionsByDevice;
    }

    /**
     * Maps connections to persistence rows
     *
     * @param {string} params.deviceId Device identifier
     * @param {Object[]} params.connections Domain connections
     * @returns {Object[]} Persistence connections
     */
    static connectionsToPersistence({ deviceId, connections }) {
        return connections.map((connection) => ({ device_id: deviceId, ...connection }));
    }
}
