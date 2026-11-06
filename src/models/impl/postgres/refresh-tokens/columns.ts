import PostgresDbUtils from "../../../../utils/postgres-db-utils.js";

const REFRESH_TOKENS_COLUMNS = {
    insert: PostgresDbUtils.createColumnSet([{ name: "user_id" }, { name: "token" }], "refresh_tokens")
};

export default REFRESH_TOKENS_COLUMNS;
