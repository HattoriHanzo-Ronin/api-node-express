export type RefreshToken = { user_id: string; token: string };
export type RefreshTokenParams = Pick<RefreshToken, "token">;
export type InsertRefreshTokenParams = { refreshToken: RefreshToken };
