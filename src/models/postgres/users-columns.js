import DbUtils from "../../utils/db-utils.js";

const { skipNullOrUndefined, createColumnSet } = DbUtils;
const TABLE = "users";
const commonColumns = [{ name: "username" }, { name: "active" }];
const infoCommonColumns = [{ name: "id" }, ...commonColumns];
const insertionColumns = [...commonColumns, { name: "password" }];
const usersColumns = {
    basicInfo: createColumnSet([...infoCommonColumns, { name: "created_at" }, { name: "updated_at" }], TABLE),
    authentication: createColumnSet(infoCommonColumns, TABLE),
    insert: createColumnSet(insertionColumns, TABLE),
    update: createColumnSet(
        insertionColumns.map((it) => ({ ...it, skip: skipNullOrUndefined })),
        TABLE
    )
};

export default usersColumns;
