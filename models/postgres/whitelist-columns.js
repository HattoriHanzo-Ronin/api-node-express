import DbUtils from "../../utils/db-utils.js";

const whitelistColumns = {
    insert: DbUtils.createColumnSet(["router_id", "allowed_device_id", "key"], { table: "whitelist" })
};

export default whitelistColumns;
