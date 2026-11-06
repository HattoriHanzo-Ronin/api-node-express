import type { InsertUserRolesParams, ReplaceUserRolesParams, UserRole, UsersByIdParams } from "../types/user-roles-model.js";

export default interface UserRolesService<Transaction> {
    /**
     * Returns roles assigned to users
     *
     * @param params.usersId User identifiers
     * @returns User role assignments
     */
    getByUsers(params: UsersByIdParams): Promise<UserRole[]>;

    /**
     * Creates user role assignments
     *
     * @param params.clientTx Transaction client
     * @param params.userRoles User role assignments
     * @returns Created user role assignments
     */
    createMany(params: InsertUserRolesParams<Transaction>): Promise<UserRole[]>;

    /**
     * Replaces roles assigned to a user
     *
     * @param params.clientTx Transaction client
     * @param params.userId User identifier
     * @param params.userRoles User role assignments
     * @returns Updated user role assignments
     */
    replace(params: ReplaceUserRolesParams<Transaction>): Promise<UserRole[]>;
}
