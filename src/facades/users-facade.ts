import type {
    AuthenticatedUserResponse,
    AuthUserParams,
    ChangePasswordParams,
    CreateUserParams,
    GetUserParams,
    UpdatedUserResponse,
    UpdateUserParams,
    UserCredentialsParams,
    UserResponse,
    UsersResponse
} from "../types/users-facade.js";
import type { UserId } from "../types/users-model.js";

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
    getById(params: GetUserParams): Promise<UserResponse>;

    /**
     * Returns an authenticated user
     *
     * @param params.username Username
     * @param params.password User password
     * @returns Authenticated user
     */
    authenticate(params: UserCredentialsParams): Promise<AuthenticatedUserResponse>;

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
