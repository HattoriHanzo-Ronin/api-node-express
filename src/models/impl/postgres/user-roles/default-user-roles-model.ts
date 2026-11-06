import type { ITask } from "pg-promise";
import PostgresClient from "../../../../utils/connection/postgres/postgres-client.js";
import USER_ROLES_COLUMNS from "./columns.js";
import type { DeleteUserRolesParams, InsertUserRolesParams, UserRole, UsersByIdParams } from "../../../../types/user-roles-model.js";

/**
 * Default PostgreSQL user roles model
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultUserRolesModel {
    private static readonly CLIENT = PostgresClient.getClient();

    static async getByUsers({ usersId }: UsersByIdParams) {
        return DefaultUserRolesModel.CLIENT.any<UserRole>(`select * from user_roles where user_id IN ($1:list)`, [usersId]);
    }

    static async insertMany({ clientTx, userRoles }: InsertUserRolesParams<ITask<unknown>>) {
        return clientTx.any<UserRole>(PostgresClient.helpers().insert(userRoles, USER_ROLES_COLUMNS.insert) + " returning *");
    }

    static async deleteByUser({ clientTx, userId }: DeleteUserRolesParams<ITask<unknown>>) {
        return clientTx.none("delete from user_roles where user_id = $1", [userId]);
    }
}
