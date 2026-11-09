import type {
    DataVersion,
    DataVersionId,
    DataVersionIds
} from "../../../../types/data-versions/data-versions-model.js";
import PostgresClient from "../../../../utils/connection/postgres/postgres-client.js";

/**
 * Default PostgreSQL data versions model
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultDataVersionsModel {
    private static readonly CLIENT = PostgresClient.getClient();

    static async getById({ id }: DataVersionId): Promise<Pick<DataVersion, "version">> {
        return DefaultDataVersionsModel.CLIENT.one<Pick<DataVersion, "version">>(
            "select version from data_versions where id = $1",
            [id]
        );
    }

    static async getByIds({ ids }: DataVersionIds): Promise<DataVersion[]> {
        return DefaultDataVersionsModel.CLIENT.any<DataVersion>(
            "select id, version from data_versions where id in ($1:csv)",
            [ids]
        );
    }
}
