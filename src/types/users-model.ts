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
