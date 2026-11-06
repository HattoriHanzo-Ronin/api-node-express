import type UsersFacade from "../facades/users-facade.js";
import type RefreshTokensService from "../services/refresh-tokens-service.js";
import type TokenProvider from "../utils/token-providers/token-provider.js";
import type { AuthAccessTokenPayload, AuthRefreshTokenPayload } from "./auth.js";

export type AuthFacadeDependencies = {
    usersFacade: UsersFacade;
    refreshTokensService: RefreshTokensService;
    accessTokenProvider: TokenProvider<AuthAccessTokenPayload>;
    refreshTokenProvider: TokenProvider<AuthRefreshTokenPayload>;
};
