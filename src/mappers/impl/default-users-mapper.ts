import type {
    MappedUser,
    MappedUserIdentity,
    UserIdentityMapperParams,
    UserMapperParams,
    UsersMapperParams
} from "../../types/users/users-mapper.js";

/**
 * Default users mapper
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultUsersMapper {
    static userToDomain(params: UserMapperParams): MappedUser;
    static userToDomain(params: UserIdentityMapperParams): MappedUserIdentity;
    static userToDomain({ source, acl }: UserMapperParams | UserIdentityMapperParams) {
        return { ...source, ...acl };
    }

    static usersToDomain({ users, aclByUser }: UsersMapperParams) {
        return users.map((user) => DefaultUsersMapper.userToDomain({ source: user, acl: aclByUser.get(user.id) }));
    }
}
