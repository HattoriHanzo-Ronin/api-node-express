import PostgresDbUtils from "../../../../utils/postgres-db-utils.js";

const WHITELIST_COLUMNS = {
    insert: PostgresDbUtils.createColumnSet(
        [{ name: "router_id", cast: "uuid" }, { name: "connection_mac" }, { name: "key" }],
        "whitelist"
    )
};

export default WHITELIST_COLUMNS;
