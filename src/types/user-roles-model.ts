import type { USER_ROLE } from "../config/constants.js";

export type Role = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export type UserRole = {
    user_id: string;
    role: Role;
    scope: string | null;
};
