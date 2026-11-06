import type { DeleteUserRolesParams, InsertUserRolesParams, UserRole, UsersByIdParams } from "../types/user-roles-model.js";

export default interface UserRolesModel<Transaction> {
    /**
     * Returns roles assigned to users
     *
     * @param params.usersId User identifiers
     * @returns User role assignments
     */
    getByUsers(params: UsersByIdParams): Promise<UserRole[]>;

    /**
     * Inserts user role assignments
     *
     * @param params.clientTx Transaction client
     * @param params.userRoles User role assignments
     * @returns Inserted user role assignments
     */
    insertMany(params: InsertUserRolesParams<Transaction>): Promise<UserRole[]>;

    /**
     * Deletes roles assigned to a user
     *
     * @param params.clientTx Transaction client
     * @param params.userId User identifier
     * @returns Deletion result
     */
    deleteByUser(params: DeleteUserRolesParams<Transaction>): Promise<null>;
}
