import type { UserCredentials } from "../types/users-model.js";
import type { AuthRefreshParams, AuthSession } from "../types/auth-facade.js";

export default interface AuthFacade {
    /**
     * Authenticates a user and creates a session
     *
     * @param params.username Username
     * @param params.password Password
     * @returns Authentication payload
     */
    login(params: UserCredentials): Promise<AuthSession>;

    /**
     * Refreshes an existing session
     *
     * @param params.refreshToken Refresh token
     * @returns Authentication payload
     */
    refresh(params: AuthRefreshParams): Promise<AuthSession>;

    /**
     * Revokes an existing session
     *
     * @param params.refreshToken Refresh token
     * @returns Revocation result
     */
    logout(params: AuthRefreshParams): Promise<null>;
}
