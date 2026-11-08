import type { MappedUserIdentity } from "../users/users-mapper.js";

export type AuthRefreshParams = { refreshToken: string };
export type AuthSession = { user: MappedUserIdentity; accessToken: string; refreshToken: string };

export type AuthAccessTokenPayload = Pick<MappedUserIdentity, "id" | "roles" | "scope">;
export type VerifiedAccessToken = AuthAccessTokenPayload & { iat: number; exp: number };
export type AuthUserParams = { authUser: VerifiedAccessToken };
export type AuthRefreshTokenPayload = Pick<MappedUserIdentity, "id">;
