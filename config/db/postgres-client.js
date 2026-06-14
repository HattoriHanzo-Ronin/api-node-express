import pgPromise from "pg-promise";
import { SECRETS } from "../constants.js";

/**
 * PostgreSQL client utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class PostgresClient {
    static getClient() {
        return client;
    }

    static executeTx(callback) {
        return client.tx(callback);
    }

    static helpers() {
        return pgp.helpers;
    }
}
const pgp = pgPromise();
const client = pgp({
    host: process.env.HOSTDB,
    port: process.env.PORTDB,
    user: process.env.USERDB,
    password: SECRETS.passDb,
    database: process.env.DB
});
