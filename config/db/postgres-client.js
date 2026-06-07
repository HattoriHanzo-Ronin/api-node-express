import pgPromise from "pg-promise";
import fs from "fs";

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
    password: fs.readFileSync(process.env.PASSDB, "utf8").trim(),
    database: process.env.DB
});
