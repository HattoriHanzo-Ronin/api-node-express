import type { GetAllUsersParams } from "../types/users-service.js";
import type {
    InsertUserParams,
    UpdateUserParams,
    UserAuthentication,
    UserBasicInfo,
    UserCredentials,
    UserId,
    UserPasswordCheck
} from "../types/users-model.js";

export default interface UsersService<Transaction> {
    /**
     * Returns all users
     *
     * @returns List of users data
     */
    getAll(params: GetAllUsersParams): Promise<UserBasicInfo[]>;

    /**
     * Returns a user by identifier
     *
     * @param params.id User identifier
     * @returns User data
     */
    getById(params: UserId): Promise<UserBasicInfo>;

    /**
     * Authenticates a user
     *
     * @param params.username Username
     * @param params.password Password
     * @returns Authenticated user data
     */
    authenticate(params: UserCredentials): Promise<UserAuthentication>;

    /**
     * Checks a user's password
     *
     * @param params.id User identifier
     * @param params.password User password
     */
    checkPassword(params: UserPasswordCheck): Promise<void>;

    /**
     * Creates a user
     *
     * @param params.clientTx Transaction client
     * @param params.user User data
     * @returns Created user data
     */
    create(params: InsertUserParams<Transaction>): Promise<UserBasicInfo>;

    /**
     * Updates a user
     *
     * @param params.clientTx Transaction client
     * @param params.id User identifier
     * @param params.data User data
     * @returns Updated user data
     */
    update(params: UpdateUserParams<Transaction>): Promise<UserBasicInfo | null>;

    /**
     * Deletes a user
     *
     * @param params.id User identifier
     * @returns Deleted user identifier
     */
    delete(params: UserId): Promise<UserId | null>;
}
