import PostgresDbUtils from "../../../utils/postgres-db-utils.js";

const { createColumnSet } = PostgresDbUtils;
const TABLE = "devices";
const commonColumns = [{ name: "name" }, { name: "model" }];
const infoCommonColumns = [{ name: "id", cast: "uuid" }, ...commonColumns];
const allowedColumns = [{ name: "type", cast: "device_type_enum" }];
const routerColumns = [{ name: "ip" }, { name: "admin_pass" }];
const insertionColumns = [
    ...commonColumns,
    ...allowedColumns,
    ...routerColumns,
    { name: "mac_filter" },
    { name: "wifi_pass" },
    { name: "ssid" }
];
const devicesColumns = {
    allowedInfo: createColumnSet([...infoCommonColumns, ...allowedColumns], TABLE),
    routerInfo: createColumnSet([...infoCommonColumns, ...routerColumns], TABLE),
    insert: createColumnSet(insertionColumns, TABLE),
    update: createColumnSet(
        insertionColumns.map((column) => ({ ...column, skip: ({ value }) => value === undefined })),
        TABLE
    )
};

export default devicesColumns;
