import { USER_ROLE } from "../config/constants.js";

/**
 * Maps user roles between domain and persistence representations
 *
 * @author HattoriHanzo-Ronin
 */
export default class UserRolesMapper {
    /**
     * Maps persistence roles by user to ACL domain data
     *
     * @param {Object[]} source Persistence roles
     * @returns {Map<string, Object>} ACL data indexed by user identifier
     */
    static rolesByUsersToDomain(source) {
        const aclByUser = new Map();
        for (const { user_id: userId, role, scope } of source) {
            let acl = aclByUser.get(userId);
            if (!acl) {
                acl = { roles: [] };
                aclByUser.set(userId, acl);
            }

            acl.roles.push(role);
            if (role === USER_ROLE.admin) {
                acl.scope = scope.split(",");
            }
        }
        return aclByUser;
    }

    /**
     * Maps roles to persistence rows
     *
     * @param {string} params.userId User identifier
     * @param {string[]} params.roles User roles
     * @param {string[] | undefined} params.scope Administrative scope
     * @returns {Object[]} Persistence role assignments
     */
    static rolesToPersistence({ userId, roles, scope }) {
        return roles.map((role) => ({
            user_id: userId,
            role,
            scope: role === USER_ROLE.admin ? scope.join(",") : null
        }));
    }
}
