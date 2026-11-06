export type RefreshToken = { user_id: string; token: string };
export type RefreshTokenParams = { token: string };
export type InsertRefreshTokenParams = { refreshToken: RefreshToken };
