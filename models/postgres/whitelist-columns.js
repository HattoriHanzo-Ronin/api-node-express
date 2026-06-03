import PostgresClient from "../../config/db/postgres-client.js";

const helpers = PostgresClient.helpers();
const whitelistColumns = {
    insert: new helpers.ColumnSet(["router_id", "allow_device_id", "key"], { table: "whitelist" })
};

export default whitelistColumns;
