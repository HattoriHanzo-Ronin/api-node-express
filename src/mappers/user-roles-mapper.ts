import type { UserRolesMapperParams } from "../types/user-roles-mapper.js";
import type { UserRole } from "../types/user-roles-model.js";
import type { UserAcl } from "../types/user-roles-facade.js";

export default interface UserRolesMapper {
    /**
     * Maps persistence roles to ACL data by user
     *
     * @param source Persistence roles
     * @returns User ACL data
     */
    rolesByUsersToDomain(source: UserRole[]): Map<string, UserAcl>;

    /**
     * Maps roles to persistence rows
     *
     * @param params.userId User identifier
     * @param params.roles User roles
     * @param params.scope Administrative scope
     * @returns Persistence role assignments
     */
    rolesToPersistence(params: UserRolesMapperParams): UserRole[];
}
