import { USER_ROLE } from "../config/constants.js";

/**
 * Maps user data between persistence and domain representations
 *
 * @author HattoriHanzo-Ronin
 */
export default class UsersMapper {
    /**
     * Maps persisted user data to the domain representation
     *
     * @param {Object} source Persisted user data
     * @returns {Object} User domain representation
     */
    static userToDomain(source) {
        const { roles, ...user } = source;
        const userRoles = roles.filter(({ user_id: userId }) => userId === user.id);
        return { ...user, ...UsersMapper.#mapRolesToDomain(userRoles) };
    }

    /**
     * Maps multiple persisted users to domain representations
     *
     * @param {Object} source Source data
     * @returns {Object[]} User domain representations
     */
    static usersToDomain(source) {
        const { users, roles } = source;
        return users.map((user) => UsersMapper.userToDomain({ ...user, roles }));
    }

    static #mapRolesToDomain(roles) {
        const adminRole = roles.find(({ role }) => role === USER_ROLE.admin);
        const userRoles = roles.map(({ role }) => role);
        return adminRole ? { roles: userRoles, scope: adminRole.scope.split(",") } : { roles: userRoles };
    }
}
