import type { RequestHandler } from "express";
import type AuthFacade from "../facades/auth-facade.js";
import type { UserCredentials } from "./users-model.js";
import type { AuthRefreshParams, AuthSession } from "./auth-facade.js";

export type AuthControllerDependencies = { authFacade: AuthFacade };
export type LoginHandler = RequestHandler<Record<string, never>, AuthSession, UserCredentials>;
export type RefreshHandler = RequestHandler<Record<string, never>, AuthSession, AuthRefreshParams>;
export type LogoutHandler = RequestHandler<Record<string, never>, void, AuthRefreshParams>;
