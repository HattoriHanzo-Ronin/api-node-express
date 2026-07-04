import DbUtils from "../../utils/db-utils.js";

const connectionsColumns = {
    insert: DbUtils.createColumnSet(
        [{ name: "device_id", cast: "uuid" }, { name: "mac" }, { name: "ctype", cast: "connection_ctype_enum" }],
        "connections"
    )
};

export default connectionsColumns;
