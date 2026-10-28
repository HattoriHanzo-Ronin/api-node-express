import PostgresDbUtils from "../../../utils/postgres-db-utils.js";

const { createColumnSet } = PostgresDbUtils;
const refreshTokensColumns = {
    insert: createColumnSet(["user_id", "token"], "refresh_tokens")
};

export default refreshTokensColumns;
