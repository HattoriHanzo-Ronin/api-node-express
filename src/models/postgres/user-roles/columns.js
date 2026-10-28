import PostgresDbUtils from "../../../utils/postgres-db-utils.js";

const { createColumnSet } = PostgresDbUtils;
const userRolesColumns = {
    insert: createColumnSet([{ name: "user_id" }, { name: "role", cast: "user_role_enum" }, { name: "scope" }], "user_roles")
};

export default userRolesColumns;
