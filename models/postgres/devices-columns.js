import PostgresClient from "../../config/db/postgres-client.js";
import DbUtils from "../../utils/db-utils.js";

const helpers = PostgresClient.helpers();
const { skipNullOrUndefined } = DbUtils;
const devicesColumns = {
    basicInfo: new helpers.ColumnSet(
        [{ name: "name" }, { name: "mac" }, { name: "intrface" }, { name: "type" }, { name: "model" }],
        { table: "devices" }
    ),
    basicRouterInfo: new helpers.ColumnSet(
        [
            { name: "id" },
            { name: "name" },
            { name: "model" },
            { name: "ip" },
            { name: "admin_pass" },
            { name: "mac_filter" }
        ],
        { table: "devices" }
    ),
    insert: new helpers.ColumnSet(
        [
            { name: "name" },
            { name: "mac" },
            { name: "intrface" },
            { name: "type" },
            { name: "model" },
            { name: "ip" },
            { name: "wifi_pass" },
            { name: "admin_pass" },
            { name: "mac_filter" }
        ],
        { table: "devices" }
    ),
    update: new helpers.ColumnSet(
        [
            { name: "name", skip: skipNullOrUndefined },
            { name: "mac", skip: skipNullOrUndefined },
            { name: "model", skip: skipNullOrUndefined },
            { name: "ip", skip: skipNullOrUndefined },
            { name: "wifi_pass", skip: skipNullOrUndefined },
            { name: "admin_pass", skip: skipNullOrUndefined },
            { name: "mac_filter", skip: skipNullOrUndefined }
        ],
        { table: "devices" }
    )
};

export default devicesColumns;
