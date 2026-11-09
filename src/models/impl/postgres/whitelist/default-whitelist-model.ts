import type { ITask } from "pg-promise";
import type { RouterIdParams } from "../../../../types/devices/devices-model.js";
import type {
    DeleteWhitelistParams,
    InsertWhitelistParams,
    Whitelist,
    WhitelistKey
} from "../../../../types/whitelist/whitelist-model.js";
import PostgresClient from "../../../../utils/connection/postgres/postgres-client.js";
import WHITELIST_COLUMNS from "./columns.js";

/**
 * Default PostgreSQL whitelist model
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultWhitelistModel {
    private static readonly CLIENT = PostgresClient.getClient();

    static async getKeys({ routerId }: RouterIdParams): Promise<WhitelistKey[]> {
        return DefaultWhitelistModel.CLIENT.any<WhitelistKey>("select key from whitelist where router_id = $1", [
            routerId
        ]);
    }

    static async insert({ clientTx, whitelist }: InsertWhitelistParams<ITask<unknown>>): Promise<null> {
        return clientTx.none(PostgresClient.helpers().insert(whitelist, WHITELIST_COLUMNS.insert));
    }

    static async delete({
        clientTx,
        routerId,
        mac
    }: DeleteWhitelistParams<ITask<unknown>>): Promise<Pick<Whitelist, "key"> | null> {
        return clientTx.oneOrNone<Pick<Whitelist, "key">>(
            "delete from whitelist where router_id = $1 and connection_mac = $2 returning key",
            [routerId, mac]
        );
    }
}
