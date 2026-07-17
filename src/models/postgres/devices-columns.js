import DbUtils from "../../utils/db-utils.js";

const { skipNullOrUndefined, createColumnSet } = DbUtils;
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
    { name: "wifi_pass" }
];
const devicesColumns = {
    allowedInfo: createColumnSet([...infoCommonColumns, ...allowedColumns], TABLE),
    routerInfo: createColumnSet([...infoCommonColumns, ...routerColumns], TABLE),
    insert: createColumnSet(insertionColumns, TABLE),
    update: createColumnSet(
        insertionColumns.map((it) => ({ ...it, skip: skipNullOrUndefined })),
        TABLE
    )
};

export default devicesColumns;
