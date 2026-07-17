import DbUtils from "../../utils/db-utils.js";

const { createColumnSet } = DbUtils;
const refreshTokensColumns = {
    insert: createColumnSet(["user_id", "token"], "refresh_tokens")
};

export default refreshTokensColumns;
