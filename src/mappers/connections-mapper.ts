import type { Connection, ConnectionData } from "../types/connections/connections-model.js";
import type { ConnectionsToPersistenceParams } from "../types/connections/connections-mapper.js";

export default interface ConnectionsMapper {
    /**
     * Maps persistence connections to the domain model
     *
     * @param source Persistence connections
     * @returns Domain connections
     */
    connectionsToDomain(source: Connection[]): ConnectionData[];

    /**
     * Maps connections by device identifier
     *
     * @param source Persistence connections
     * @returns Connections by device
     */
    connectionsByDeviceToDomain(source: Connection[]): Map<string, ConnectionData[]>;

    /**
     * Maps connections to persistence rows
     *
     * @param params.deviceId Device identifier
     * @param params.connections Domain connections
     * @returns Persistence connections
     */
    connectionsToPersistence(params: ConnectionsToPersistenceParams): Connection[];
}
