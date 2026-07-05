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
        let { roles, ...user } = source;
        roles = roles.filter(({ user_id: userId }) => userId === user.id);
        return { ...user, ...mapRolesToDomain(roles) };
    }

    /**
     * Maps multiple persisted users to domain representations
     *
     * @param {Object} source Source data
     * @returns {Object[]} User domain representations
     */
    static usersToDomain(source) {
        const { users, roles } = source;
        return users.map((user) => this.userToDomain({ ...user, roles }));
    }
}

function mapRolesToDomain(roles) {
    const adminRole = roles.find(({ role }) => role === "ADMIN");
    roles = roles.map(({ role }) => role);
    return adminRole ? { roles, scope: adminRole.scope.split(",") } : { roles };
}
