import PostgresDbUtils from "../../../../utils/postgres-db-utils.js";

const { createColumnSet } = PostgresDbUtils;
const TABLE = "devices";
const COMMON_COLUMNS = [{ name: "name" }, { name: "model" }];
const INFO_COMMON_COLUMNS = [{ name: "id", cast: "uuid" }, ...COMMON_COLUMNS];
const ALLOWED_COLUMNS = [{ name: "type", cast: "device_type_enum" }];
const ROUTER_COLUMNS = [{ name: "ip" }, { name: "admin_pass" }];
const INSERTION_COLUMNS = [
    ...COMMON_COLUMNS,
    ...ALLOWED_COLUMNS,
    ...ROUTER_COLUMNS,
    { name: "mac_filter" },
    { name: "wifi_pass" },
    { name: "ssid" }
];
const DEVICES_COLUMNS = {
    allowedInfo: createColumnSet([...INFO_COMMON_COLUMNS, ...ALLOWED_COLUMNS], TABLE),
    routerInfo: createColumnSet([...INFO_COMMON_COLUMNS, ...ROUTER_COLUMNS], TABLE),
    insert: createColumnSet(INSERTION_COLUMNS, TABLE),
    update: createColumnSet(
        INSERTION_COLUMNS.map((column) => ({ ...column, skip: ({ value }) => value === undefined })),
        TABLE
    )
};

export default DEVICES_COLUMNS;
