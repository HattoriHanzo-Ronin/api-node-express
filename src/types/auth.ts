import type { AuthenticatedUser } from "./users-facade.js";

export type AuthAccessTokenPayload = Pick<AuthenticatedUser, "id" | "roles" | "scope">;

export type AuthRefreshTokenPayload = Pick<AuthenticatedUser, "id">;
