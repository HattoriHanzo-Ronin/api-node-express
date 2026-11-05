import type {
    InsertUserParams,
    PasswordCheckResult,
    UpdateUserParams,
    UserAuthentication,
    UserBasicInfo,
    UserCredentials,
    UserId,
    UserPasswordCheck
} from "../types/users-model.js";

export default interface UsersModel<Transaction> {
    /**
     * Returns all users
     *
     * @returns List of users
     */
    getAll(): Promise<UserBasicInfo[]>;

    /**
     * Returns a user by identifier
     *
     * @param params.id User identifier
     * @returns User data
     */
    getById(params: UserId): Promise<UserBasicInfo | null>;

    /**
     * Authenticates a user
     *
     * @param params.username Username
     * @param params.password Password
     * @returns User data
     */
    authenticate(params: UserCredentials): Promise<UserAuthentication | null>;

    /**
     * Checks a user's password
     *
     * @param params.id User identifier
     * @param params.password User password
     * @returns Password check result
     */
    checkPassword(params: UserPasswordCheck): Promise<PasswordCheckResult | null>;

    /**
     * Inserts a user
     *
     * @param params.clientTx Transaction client
     * @param params.user User data
     * @returns Inserted user data
     */
    insert(params: InsertUserParams<Transaction>): Promise<UserBasicInfo>;

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
