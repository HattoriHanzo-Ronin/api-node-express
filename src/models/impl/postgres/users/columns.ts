import PostgresDbUtils from "../../../../utils/postgres-db-utils.js";

const { skipNullOrUndefined, createColumnSet } = PostgresDbUtils;
const TABLE = "users";
const COMMON_COLUMNS = [{ name: "username" }, { name: "active" }];
const INFO_COMMON_COLUMNS = [{ name: "id" }, ...COMMON_COLUMNS];
const INSERTION_COLUMNS = [...COMMON_COLUMNS, { name: "password" }];
const USERS_COLUMNS = {
    basicInfo: createColumnSet([...INFO_COMMON_COLUMNS, { name: "created_at" }, { name: "updated_at" }], TABLE),
    authentication: createColumnSet(INFO_COMMON_COLUMNS, TABLE),
    insert: createColumnSet(INSERTION_COLUMNS, TABLE),
    update: createColumnSet(
        INSERTION_COLUMNS.map((column) => ({ ...column, skip: skipNullOrUndefined })),
        TABLE
    )
};

export default USERS_COLUMNS;
