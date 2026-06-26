import DbUtils from "../../utils/db-utils.js";

const { skipNullOrUndefined, createColumnSet } = DbUtils;
const TABLE = "devices";
const commonColumns = [{ name: "name" }, { name: "model" }];
const infoCommonColumns = [{ name: "id" }, ...commonColumns];
const allowedColumns = [
    { name: "mac" },
    { name: "intrface", cast: "device_intrface_enum" },
    { name: "type", cast: "device_type_enum" }
];
const routerColumns = [{ name: "ip" }, { name: "admin_pass" }, { name: "mac_filter" }];
const insertionColumns = [...commonColumns, ...allowedColumns, ...routerColumns, { name: "wifi_pass" }];
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
