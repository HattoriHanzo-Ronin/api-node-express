import type { UserRolesMapperParams } from "../../types/user-roles-mapper.js";
import type { Role, UserRole } from "../../types/user-roles-model.js";
import type { UserAcl } from "../../types/user-roles-facade.js";
import { USER_ROLE } from "../../config/constants.js";

/**
 * Default user roles mapper
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultUserRolesMapper {
    static rolesByUsersToDomain(source: UserRole[]): Map<string, UserAcl> {
        const aclByUser = new Map<string, UserAcl>();
        for (const { user_id: userId, role, scope } of source) {
            let acl = aclByUser.get(userId);
            if (!acl) {
                acl = { roles: [] };
                aclByUser.set(userId, acl);
            }

            acl.roles.push(role);
            if (role === USER_ROLE.admin) {
                acl.scope = scope!.split(",") as Role[];
            }
        }
        return aclByUser;
    }

    static rolesToPersistence({ userId, roles, scope }: UserRolesMapperParams): UserRole[] {
        return roles!.map((role) => ({
            user_id: userId,
            role,
            scope: role === USER_ROLE.admin ? scope!.join(",") : null
        }));
    }
}
