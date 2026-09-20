import PostgresClient from "../../config/db/postgres-client.js";

/**
 * Data versions table model
 *
 * @author HattoriHanzo-Ronin
 */
export default class DataVersionsModel {
    /**
     * Returns a data version by its resource identifier
     *
     * @param {string} params.id Resource identifier
     * @returns {Promise<{ version: string } | null>} Data version
     */
    static async getById({ id }) {
        return client.oneOrNone("select version from data_versions where id = $1", [id]);
    }

    /**
     * Returns data versions by their resource identifiers
     *
     * @param {string[]} params.ids Resource identifiers
     * @returns {Promise<{ id: string, version: string }[]>} Data versions
     */
    static async getByIds({ ids }) {
        return client.any("select id, version from data_versions where id in ($1:csv)", [ids]);
    }

}

const { getClient } = PostgresClient;
const client = getClient();
