import pgPromise from "pg-promise";

/**
 * PostgreSQL client utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class PostgresClient {
    static getClient() {
        return client;
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
    password: process.env.PASSDB,
    database: process.env.DB
});
