import type { ITask } from "pg-promise";
import type { Connection, ConnectionsByDevicesParams, DeleteConnectionsParams, WriteConnectionsParams } from "../../../../types/connections-model.js";
import PostgresClient from "../../../../utils/connection/postgres/postgres-client.js";
import CONNECTIONS_COLUMNS from "./columns.js";

const { getClient, helpers } = PostgresClient;
const { insert } = CONNECTIONS_COLUMNS;

/**
 * Connections table model
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultConnectionsModel {
    private static readonly CLIENT = getClient();

    static getByDevices({ devicesId }: ConnectionsByDevicesParams): Promise<Connection[]> {
        return DefaultConnectionsModel.CLIENT.any<Connection>(`select * from connections where device_id in ($1:list)`, [devicesId]);
    }

    static insertMany({ clientTx, connections }: WriteConnectionsParams<ITask<unknown>>): Promise<Connection[]> {
        return clientTx.many<Connection>(helpers().insert(connections, insert) + " returning *");
    }

    static updateMany({ clientTx, connections }: WriteConnectionsParams<ITask<unknown>>): Promise<Connection[]> {
        return clientTx.many<Connection>(
            helpers().update(connections, insert) +
                ` where t.device_id = v.device_id::uuid and t.ctype = v.ctype::connection_ctype_enum
                  returning t.*`
        );
    }

    static deleteMany({ clientTx, macs }: DeleteConnectionsParams<ITask<unknown>>): Promise<Connection[]> {
        return clientTx.many<Connection>("delete from connections where mac in ($1:list) returning *", [macs]);
    }
}
