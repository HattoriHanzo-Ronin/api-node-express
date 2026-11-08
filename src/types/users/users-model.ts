export type User = {
    id: string;
    username: string;
    password: string;
    active: boolean;
    created_at: Date;
    updated_at: Date;
};

export type UserBasicInfo = Omit<User, "password">;

export type UserAuthentication = Pick<User, "id" | "username" | "active">;

export type UserInsert = Pick<User, "username" | "password" | "active">;

export type UserUpdate = Partial<UserInsert>;

export type UserId = Pick<User, "id">;

export type UserCredentials = Pick<UserInsert, "username" | "password">;
export type UserPasswordCheck = UserId & Pick<UserInsert, "password">;
export type PasswordCheckResult = Record<string, boolean>;
export type InsertUserParams<Transaction> = { clientTx: Transaction; user: UserInsert };
export type UpdateUserParams<Transaction> = { clientTx: Transaction; id: string; data: UserUpdate };
