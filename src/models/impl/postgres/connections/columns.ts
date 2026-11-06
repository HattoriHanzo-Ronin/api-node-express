import PostgresDbUtils from "../../../../utils/postgres-db-utils.js";

const CONNECTIONS_COLUMNS = {
    insert: PostgresDbUtils.createColumnSet(
        [{ name: "device_id", cast: "uuid" }, { name: "mac" }, { name: "ctype", cast: "connection_ctype_enum" }],
        "connections"
    )
};

export default CONNECTIONS_COLUMNS;
