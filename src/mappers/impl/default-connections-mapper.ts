import type { Connection, ConnectionData } from "../../types/connections-model.js";
import type { ConnectionsToPersistenceParams } from "../../types/connections-mapper.js";

/**
 * Maps connection data between domain and persistence representations
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultConnectionsMapper {
    static connectionsToDomain(source: Connection[]): ConnectionData[] {
        return source.map(({ mac, ctype }) => ({ mac, ctype }));
    }

    static connectionsByDeviceToDomain(source: Connection[]): Map<string, ConnectionData[]> {
        const connectionsByDevice = new Map<string, Connection[]>();
        for (const connection of source) {
            const { device_id: deviceId } = connection;
            const connections = connectionsByDevice.get(deviceId) ?? [];
            connections.push(connection);
            connectionsByDevice.set(deviceId, connections);
        }
        return new Map([...connectionsByDevice].map(([deviceId, connections]) =>
            [deviceId, DefaultConnectionsMapper.connectionsToDomain(connections)]
        ));
    }

    static connectionsToPersistence({ deviceId, connections }: ConnectionsToPersistenceParams): Connection[] {
        return connections.map((connection) => ({ device_id: deviceId, ...connection }));
    }
}
