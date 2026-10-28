import PostgresDbUtils from "../../../utils/postgres-db-utils.js";

const connectionsColumns = {
    insert: PostgresDbUtils.createColumnSet(
        [{ name: "device_id", cast: "uuid" }, { name: "mac" }, { name: "ctype", cast: "connection_ctype_enum" }],
        "connections"
    )
};

export default connectionsColumns;
