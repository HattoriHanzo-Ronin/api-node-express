/**
 * Maps user data between persistence and domain representations
 *
 * @author HattoriHanzo-Ronin
 */
export default class UsersMapper {
    /**
     * Maps persisted user data to the domain representation
     *
     * @param {Object} params.source Persisted user data
     * @param {Object} params.acl User ACL data
     * @returns {Object} User domain representation
     */
    static userToDomain({ source, acl }) {
        return { ...source, ...acl };
    }

    /**
     * Maps multiple persisted users to domain representations
     *
     * @param {Object[]} params.users Persisted users
     * @param {Map<string, Object>} params.aclByUser User ACL data by identifier
     * @returns {Object[]} User domain representations
     */
    static usersToDomain({ users, aclByUser }) {
        return users.map((user) => UsersMapper.userToDomain({ source: user, acl: aclByUser.get(user.id) }));
    }
}
