import pgPromise from "pg-promise";
import { ENV, SECRETS } from "../constants.js";

/**
 * PostgreSQL client utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class PostgresClient {
    /**
     * Returns the PostgreSQL client
     *
     * @returns {import("pg-promise").IDatabase<unknown>} PostgreSQL client
     */
    static getClient() {
        return client;
    }

    /**
     * Executes a PostgreSQL transaction
     *
     * @param {Function} callback Transaction callback
     * @returns {Promise<unknown>} Transaction result
     */
    static executeTx(callback) {
        return client.tx(callback);
    }

    /**
     * Returns pg-promise helpers
     *
     * @returns {import("pg-promise").IHelpers} pg-promise helpers
     */
    static helpers() {
        return pgp.helpers;
    }
}
const pgp = pgPromise();
const { dbHost, dbPort, dbUser, dbName } = ENV;
const client = pgp({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: SECRETS.passDb,
    database: dbName
});
