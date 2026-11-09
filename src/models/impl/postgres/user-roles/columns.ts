import PostgresDbUtils from "../../../../utils/postgres-db-utils.js";

const USER_ROLES_COLUMNS = {
    insert: PostgresDbUtils.createColumnSet(
        [{ name: "user_id" }, { name: "role", cast: "user_role_enum" }, { name: "scope" }],
        "user_roles"
    )
};

export default USER_ROLES_COLUMNS;
