import type ConnectionsService from "../connections-service.js";
import type { ConnectionsServiceDependencies } from "../../types/connections/default-connections-service.js";
import type { ConnectionsByDevicesParams, WriteConnectionsParams } from "../../types/connections/connections-model.js";
import type { ConnectionsUpdateResult, UpdateConnectionsParams } from "../../types/connections/connections-service.js";
import type { PostgresError } from "../../types/utils/postgres-error.js";
import ApiError from "../../utils/error/api-error.js";
import Logger from "../../utils/logger/logger.js";
import { LOG_EVENT } from "../../config/log-events.js";
import { API_ERROR } from "../../config/errors.js";

const { connectionRequired, connectionCreateFailed, connectionUpdateFailed } = API_ERROR;

/**
 * Default connections service
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultConnectionsService<Transaction> implements ConnectionsService<Transaction> {
    private static readonly LOGGER = Logger.getLogger(DefaultConnectionsService);

    constructor(private readonly dependencies: ConnectionsServiceDependencies<Transaction>) {}

    async getByDevices({ devicesId }: ConnectionsByDevicesParams) {
        return this.dependencies.connectionsModel.getByDevices({ devicesId });
    }

    async createMany({ clientTx, connections }: WriteConnectionsParams<Transaction>) {
        try {
            ApiError.handle([
                {
                    condition: !connections,
                    message: "Se debe especificar al menos una conexión para el dispositivo",
                    apiError: connectionRequired
                }
            ]);
            return await this.dependencies.connectionsModel.insertMany({ clientTx, connections });
        } catch (err) {
            this.dependencies.entityError(err as PostgresError);
            ApiError.handle([
                {
                    condition: !(err instanceof ApiError && err.code === connectionRequired),
                    execute: () => {
                        if (!(err instanceof ApiError)) {
                            DefaultConnectionsService.LOGGER.error({
                                event: LOG_EVENT.databaseOperationFailed,
                                message: "Failed to create connections",
                                error: err
                            });
                        }
                    },
                    message: "Error al crear las conexiones del dispositivo",
                    apiError: connectionCreateFailed,
                    cause: err
                }
            ]);
            throw err;
        }
    }

    async update({ clientTx, connections, oldConnections }: UpdateConnectionsParams<Transaction>) {
        try {
            let result: ConnectionsUpdateResult = {};
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
                const deletedConnections = await this.dependencies.connectionsModel.deleteMany({
                    clientTx,
                    macs: deleteConnections
                });
                result = { deletedConnections };
            }

            if (createConnections.length > 0) {
                const createdConnections = await this.dependencies.connectionsModel.insertMany({
                    clientTx,
                    connections: createConnections
                });
                result = { ...result, createdConnections };
            }

            if (updateConnections.length > 0) {
                const updatedConnections = await this.dependencies.connectionsModel.updateMany({
                    clientTx,
                    connections: updateConnections
                });
                result = { ...result, updatedConnections };
            }

            return result;
        } catch (err) {
            this.dependencies.entityError(err as PostgresError);
            if (!(err instanceof ApiError)) {
                DefaultConnectionsService.LOGGER.error({
                    event: LOG_EVENT.databaseOperationFailed,
                    message: "Failed to update connections",
                    error: err
                });
            }

            throw new ApiError({
                message: "Error al actualizar las conexiones del dispositivo",
                apiError: connectionUpdateFailed,
                cause: err
            });
        }
    }
}
