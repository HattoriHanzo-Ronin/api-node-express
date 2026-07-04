import PostgresErrors from "../utils/postgres-errors.js";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * Connections service
 *
 * @author HattoriHanzo-Ronin
 */
export default class ConnectionsService {
    constructor({ connectionsModel }) {
        this.connectionsModel = connectionsModel;
    }

    /**
     * Returns the connections associated with multiple devices
     *
     * @param {string[]} params.devicesId Device identifiers
     * @returns {Promise<Object[]>} Connections
     */
    async getByDevices({ devicesId }) {
        return this.connectionsModel.getByDevices({ devicesId });
    }

    /**
     * Creates the connections associated with a device
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {string} params.deviceId Device identifier
     * @param {Object[]} params.connections Connections
     * @returns {Promise<Object[]>} Created connections
     */
    async createMany({ clientTx, deviceId, connections }) {
        try {
            handleApiErrors([
                {
                    condition: !connections,
                    message: "Se debe especificar al menos una conexión para el dispositivo",
                    code: "CONNECTION_REQUIRED"
                }
            ]);
            connections = connections.map((it) => ({ device_id: deviceId, ...it }));
            return await this.connectionsModel.insertMany({ clientTx, connections });
        } catch (err) {
            postgresError(err);
            handleApiErrors([
                {
                    condition: err.code !== "CONNECTION_REQUIRED",
                    message: "Error al crear las conexiones del dispositivo",
                    code: "CONNECTION_CREATE_FAILED"
                }
            ]);
            throw err;
        }
    }

    /**
     * Updates the connections associated with a device
     *
     * @param {import("pg-promise").ITask<any>} params.clientTx Database transaction
     * @param {string} params.deviceId Device identifier
     * @param {Object[]} params.connections Connections
     * @param {Object[]} params.oldConnections Current connections
     * @returns {Promise<{
     *     deletedConnections: Object[] | undefined,
     *     createdConnections: Object[] | undefined,
     *     updatedConnections: Object[] | undefined
     * }>} Updated connections
     */
    async update({ clientTx, deviceId, connections, oldConnections }) {
        try {
            connections = connections.map((it) => ({ device_id: deviceId, ...it }));
            oldConnections = oldConnections.map((it) => ({ device_id: deviceId, ...it }));
            let result = {};
            const deleteConnections = oldConnections
                .filter(({ ctype }) => !connections.some(({ ctype: connectionCtype }) => connectionCtype === ctype))
                .map(({ mac }) => mac);
            const createConnections = connections.filter(
                ({ ctype }) => !oldConnections.some(({ ctype: oldCtype }) => oldCtype === ctype)
            );
            const updateConnections = connections.filter(({ ctype, mac }) => {
                const old = oldConnections.find(({ ctype: oldCtype }) => oldCtype === ctype);
                return old && old.mac !== mac;
            });
            if (deleteConnections.length > 0) {
                const deletedConnections = await this.connectionsModel.deleteMany({
                    clientTx,
                    macs: deleteConnections
                });
                result = { deletedConnections };
            }

            if (createConnections.length > 0) {
                const createdConnections = await this.connectionsModel.insertMany({
                    clientTx,
                    connections: createConnections
                });
                result = { ...result, createdConnections };
            }

            if (updateConnections.length > 0) {
                const updatedConnections = await this.connectionsModel.updateMany({
                    clientTx,
                    connections: updateConnections
                });
                result = { ...result, updatedConnections };
            }

            return result;
        } catch (err) {
            postgresError(err);
            handleApiErrors([
                {
                    condition: true,
                    message: "Error al actualizar las conexiones del dispositivo",
                    code: "CONNECTION_UPDATE_FAILED"
                }
            ]);
        }
    }
}

const { handleApiErrors } = ValidateUtils;
const { connections: postgresError } = PostgresErrors;
