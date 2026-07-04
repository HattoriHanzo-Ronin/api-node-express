import DbUtils from "../../utils/db-utils.js";

const whitelistColumns = {
    insert: DbUtils.createColumnSet(
        [{ name: "router_id", cast: "uuid" }, { name: "connection_mac" }, { name: "key" }],
        "whitelist"
    )
};

export default whitelistColumns;
