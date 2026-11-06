import type { AuthenticatedUserResponse } from "./users-facade.js";

export type AuthRefreshParams = { refreshToken: string };
export type AuthSession = { user: AuthenticatedUserResponse; accessToken: string; refreshToken: string };
