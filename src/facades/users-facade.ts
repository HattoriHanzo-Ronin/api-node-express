import type { AuthUserParams } from "../types/auth/auth-facade.js";
import type {
    ChangePasswordParams,
    CreateUserParams,
    GetUserParams,
    GetUserWithoutAuthParams,
    UpdatedUserResponse,
    UpdateUserParams,
    UserResponse,
    UsersResponse
} from "../types/users/users-facade.js";
import type { UserCredentials, UserId } from "../types/users/users-model.js";
import type { MappedUser, MappedUserIdentity } from "../types/users/users-mapper.js";

export default interface UsersFacade {
    /**
     * Returns all users accessible by the authenticated user
     *
     * @param params.authUser Authenticated user
     * @returns User collection
     */
    getAll(params: AuthUserParams): Promise<UsersResponse>;

    /**
     * Returns a user by identifier
     *
     * @param params.authUser Authenticated user
     * @param params.id User identifier
     * @returns User data
     */
    getById(params: GetUserWithoutAuthParams): Promise<MappedUser>;
    getById(params: GetUserParams): Promise<UserResponse>;

    /**
     * Returns an authenticated user
     *
     * @param params.username Username
     * @param params.password User password
     * @returns Authenticated user
     */
    authenticate(params: UserCredentials): Promise<MappedUserIdentity>;

    /**
     * Creates a user
     *
     * @param params.authUser Authenticated user
     * @param params.user User data
     * @returns Created user
     */
    create(params: CreateUserParams): Promise<UserResponse>;

    /**
     * Updates a user
     *
     * @param params.authUser Authenticated user
     * @param params.data User data to update
     * @param params.changePassword Whether the current password challenge was validated
     * @returns Updated user
     */
    update(params: UpdateUserParams): Promise<UpdatedUserResponse>;

    /**
     * Changes the authenticated user's password
     *
     * @param params.authUser Authenticated user
     * @param params.currentPassword Current password
     * @param params.newPassword New password
     */
    changePassword(params: ChangePasswordParams): Promise<void>;

    /**
     * Deletes a user
     *
     * @param params.authUser Authenticated user
     * @param params.id User identifier
     * @returns Deleted user identifier, or null
     */
    delete(params: GetUserParams): Promise<UserId | null>;
}
