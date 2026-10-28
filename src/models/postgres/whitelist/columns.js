import PostgresDbUtils from "../../../utils/postgres-db-utils.js";

const whitelistColumns = {
    insert: PostgresDbUtils.createColumnSet(
        [{ name: "router_id", cast: "uuid" }, { name: "connection_mac" }, { name: "key" }],
        "whitelist"
    )
};

export default whitelistColumns;
