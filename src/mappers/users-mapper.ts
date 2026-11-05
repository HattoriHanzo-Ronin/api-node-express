import type {
    MappedUser,
    MappedUserIdentity,
    UserIdentityMapperParams,
    UserMapperParams,
    UsersMapperParams
} from "../types/users-mapper.js";

export default interface UsersMapper {
    /**
     * Maps persisted user data to the domain representation
     *
     * @param params.source Persisted user data
     * @param params.acl User ACL data
     * @returns User domain representation
     */
    userToDomain(params: UserMapperParams): MappedUser;
    userToDomain(params: UserIdentityMapperParams): MappedUserIdentity;

    /**
     * Maps multiple persisted users to domain representations
     *
     * @param params.users Persisted users
     * @param params.aclByUser User ACL data by identifier
     * @returns User domain representations
     */
    usersToDomain(params: UsersMapperParams): MappedUser[];
}
