import { AuthenticatedUser } from "./users-facade.js";

export type AuthAccessTokenPayload = Pick<AuthenticatedUser, "id" | "roles" | "scope">;