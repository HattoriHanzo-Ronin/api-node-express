import type AuthController from "../controllers/auth-controller.js";
import type DevicesController from "../controllers/devices-controller.js";
import type FtpController from "../controllers/ftp-controller.js";
import type SocketSessionsController from "../controllers/socket-sessions-controller.js";
import type UsersController from "../controllers/users-controller.js";
import type WhitelistController from "../controllers/whitelist-controller.js";
import type TokenProvider from "../utils/token-providers/token-provider.js";
import type { AuthAccessTokenPayload, VerifiedAccessToken } from "./auth.js";

/**
 * Application dependencies
 *
 * @author HattoriHanzo-Ronin
 */
export type AppDependencies = {
    ftpController: FtpController;
    whitelistController: WhitelistController;
    devicesController: DevicesController;
    usersController: UsersController;
    authController: AuthController;
    socketSessionsController: SocketSessionsController;
    accessTokenProvider: TokenProvider<AuthAccessTokenPayload, VerifiedAccessToken>;
};
