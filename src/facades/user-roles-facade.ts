import type { UserAcl, UserAclByUser, UserRolesWriteParams } from "../types/user-roles-facade.js";
import type { UsersByIdParams } from "../types/user-roles-model.js";

export default interface UserRolesFacade<Transaction> {
    /**
     * Returns user ACL data indexed by user identifier
     *
     * @param params.usersId Validated user identifiers
     * @returns User ACL data
     */
    getByUsers(params: UsersByIdParams): Promise<UserAclByUser>;

    /**
     * Creates user roles
     *
     * @param params.clientTx Transaction client
     * @param params.userId User identifier
     * @param params.roles User roles
     * @param params.scope Administrative scope
     * @returns User ACL data
     */
    createMany(params: UserRolesWriteParams<Transaction>): Promise<UserAcl>;

    /**
     * Replaces user roles
     *
     * @param params.clientTx Transaction client
     * @param params.userId User identifier
     * @param params.roles User roles
     * @param params.scope Administrative scope
     * @returns User ACL data
     */
    replace(params: UserRolesWriteParams<Transaction>): Promise<UserAcl>;
}
