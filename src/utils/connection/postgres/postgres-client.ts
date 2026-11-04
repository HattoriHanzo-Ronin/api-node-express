import pgPromise, { IDatabase, IHelpers } from "pg-promise";
import { ENV } from "../../../config/environment.js";
import { SECRETS } from "../../../config/secrets.js";

const pgp = pgPromise();
const { dbHost, dbPort, dbUser, dbName } = ENV;
const client = pgp({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: SECRETS.passDb,
    database: dbName
});

/**
 * PostgreSQL client utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class PostgresClient {
    /**
     * Returns the PostgreSQL client
     *
     * @returns PostgreSQL client
     */
    static getClient(): IDatabase<unknown> {
        return client;
    }

    /**
     * Executes a PostgreSQL transaction
     *
     * @param callback Transaction callback
     * @returns Transaction result
     */
    static executeTx<T>(callback: () => T | Promise<T>): Promise<T> {
        return client.tx(callback);
    }

    /**
     * Returns pg-promise helpers
     *
     * @returns pg-promise helpers
     */
    static helpers(): IHelpers {
        return pgp.helpers;
    }
}
