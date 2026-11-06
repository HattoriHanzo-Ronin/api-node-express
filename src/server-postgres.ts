import { createServer } from "node:http";
import { createApp } from "./app.js";

import PostgresClient from "./utils/connection/postgres/postgres-client.js";
import PostgresErrors from "./utils/error/postgres/postgres-errors.js";

import FtpController from "./controllers/ftp-controller.js";
import FtpService from "./services/ftp-service.js";
import FtpPooledConnectionManager from "./utils/connection/ftp/manager/impl/ftp-pooled-connection-manager.js";
import FtpMapper from "./mappers/ftp-mapper.js";
import FtpFacade from "./facades/ftp-facade.js";
import MemoryCache from "./utils/cache/impl/memory-cache.js";
import DirectoryCache from "./utils/cache/impl/directory-cache.js";
import DataVersionsModel from "./models/postgres/data-versions/data-versions-model.js";
import DataVersionsService from "./services/data-versions-service.js";
import DataVersionsMapper from "./mappers/data-versions-mapper.js";
import DataVersionsFacade from "./facades/data-versions-facade.js";

import ConnectionsModel from "./models/postgres/connections/connections-model.js";
import ConnectionsService from "./services/connections-service.js";
import ConnectionsMapper from "./mappers/connections-mapper.js";
import ConnectionsFacade from "./facades/connections-facade.js";
import DevicesModel from "./models/postgres/devices/devices-model.js";
import DevicesService from "./services/devices-service.js";
import DevicesMapper from "./mappers/devices-mapper.js";
import DevicesFacade from "./facades/devices-facade.js";
import DevicesController from "./controllers/devices-controller.js";
import RouterAutomation from "./utils/devices-routers/automation/impl/router-automation-manager.js";
import RouterCpanelClient from "./utils/devices-routers/cpanel/impl/router-cpanel-client.js";
import WhitelistModel from "./models/postgres/whitelist/whitelist-model.js";
import WhitelistService from "./services/whitelist-service.js";
import WhitelistFacade from "./facades/whitelist-facade.js";
import WhitelistController from "./controllers/whitelist-controller.js";

import DefaultUserRolesModel from "./models/impl/postgres/user-roles/default-user-roles-model.js";
import DefaultUserRolesService from "./services/impl/default-user-roles-service.js";
import DefaultUserRolesMapper from "./mappers/impl/default-user-roles-mapper.js";
import DefaultUserRolesFacade from "./facades/impl/default-user-roles-facade.js";
import DefaultUsersModel from "./models/impl/postgres/users/default-users-model.js";
import DefaultUsersMapper from "./mappers/impl/default-users-mapper.js";
import DefaultUsersService from "./services/impl/default-users-service.js";
import DefaultUsersFacade from "./facades/impl/default-users-facade.js";
import UsersController from "./controllers/users-controller.js";
import DefaultRefreshTokensModel from "./models/impl/postgres/refresh-tokens/default-refresh-tokens-model.js";
import DefaultRefreshTokensService from "./services/impl/default-refresh-tokens-service.js";
import DefaultAuthFacade from "./facades/impl/default-auth-facade.js";
import AuthController from "./controllers/auth-controller.js";
import { ENV } from "./config/environment.js";
import { SECRETS } from "./config/secrets.js";
import JwtProvider from "./utils/token-providers/impl/jwt-token-provider.js";
import SocketSessionsService from "./services/socket-sessions-service.js";
import SocketSessionsController from "./controllers/socket-sessions-controller.js";
import SocketSessionsFacade from "./facades/socket-sessions-facade.js";
import WebSocketEventsGateway from "./utils/gateways/impl/socket-events-gateway.js";
import type { AuthAccessTokenPayload, AuthRefreshTokenPayload } from "./types/auth.js";

const tx = PostgresClient.executeTx;
const { jwtAccessTokenExpiresIn, jwtRefreshTokenExpiresIn, routerCpanelServiceUrl } = ENV;
const { jwtSecret, refreshJwtSecret } = SECRETS;
const {
    connections: connectionsEntityError,
    devices: devicesEntityError,
    whitelist: whitelistEntityError,
    users: usersEntityError,
    refreshTokens: refreshTokensEntityError
} = PostgresErrors;

const socketSessionsService = new SocketSessionsService();
const socketSessionsFacade = new SocketSessionsFacade({ socketSessionsService });
const socketSessionsController = new SocketSessionsController({ socketSessionsFacade });

const memoryCache = new MemoryCache();
const directoryCache = new DirectoryCache();
const ftpConnectionManager = new FtpPooledConnectionManager();
const ftpService = new FtpService({ ftpConnectionManager });
const ftpFacade = new FtpFacade({ ftpService, ftpMapper: FtpMapper, memoryCache, directoryCache, socketSessionsFacade });
const ftpController = new FtpController({ ftpFacade });

const dataVersionsService = new DataVersionsService({ dataVersionsModel: DataVersionsModel });
const dataVersionsFacade = new DataVersionsFacade({
    dataVersionsService,
    dataVersionsMapper: DataVersionsMapper,
    ftpFacade
});

const connectionsService = new ConnectionsService({
    connectionsModel: ConnectionsModel,
    entityError: connectionsEntityError
});
const connectionsFacade = new ConnectionsFacade({
    connectionsService,
    connectionsMapper: ConnectionsMapper
});

const devicesService = new DevicesService({ devicesModel: DevicesModel, entityError: devicesEntityError });
const routerAutomation = RouterAutomation;
const devicesMapper = new DevicesMapper({ routerAutomation });
const routerCpanel = new RouterCpanelClient({ routerCpanelServiceUrl });
const devicesFacade = new DevicesFacade({
    devicesService,
    dataVersionsFacade,
    devicesMapper,
    connectionsFacade,
    routerAutomation,
    routerCpanel,
    socketSessionsFacade,
    tx
});
const devicesController = new DevicesController({ devicesFacade });

const whitelistService = new WhitelistService({ whitelistModel: WhitelistModel, entityError: whitelistEntityError });
const whitelistFacade = new WhitelistFacade({
    whitelistService,
    dataVersionsFacade,
    devicesFacade,
    routerAutomation,
    socketSessionsFacade,
    tx
});
const whitelistController = new WhitelistController({ whitelistFacade });

const userRolesService = new DefaultUserRolesService({ userRolesModel: DefaultUserRolesModel });
const userRolesFacade = new DefaultUserRolesFacade({
    userRolesService,
    userRolesMapper: DefaultUserRolesMapper
});

const usersService = new DefaultUsersService({ usersModel: DefaultUsersModel, entityError: usersEntityError });
const usersFacade = new DefaultUsersFacade({
    usersService,
    dataVersionsFacade,
    userRolesFacade,
    usersMapper: DefaultUsersMapper,
    socketSessionsFacade,
    tx
});
const usersController = new UsersController({ usersFacade });

const refreshTokensService = new DefaultRefreshTokensService({
    refreshTokensModel: DefaultRefreshTokensModel,
    entityError: refreshTokensEntityError
});

const accessTokenProvider = new JwtProvider<AuthAccessTokenPayload>({ secret: jwtSecret, expiresIn: jwtAccessTokenExpiresIn });
const refreshTokenProvider = new JwtProvider<AuthRefreshTokenPayload>({ secret: refreshJwtSecret, expiresIn: jwtRefreshTokenExpiresIn });
const socketGateway = new WebSocketEventsGateway({ socketSessionsFacade, accessTokenProvider });
const authFacade = new DefaultAuthFacade({
    usersFacade,
    refreshTokensService,
    accessTokenProvider,
    refreshTokenProvider
});
const authController = new AuthController({ authFacade });

const app = createApp({
    ftpController,
    whitelistController,
    devicesController,
    usersController,
    authController,
    socketSessionsController,
    accessTokenProvider
});
const server = createServer(app);
socketGateway.attach({ server });
server.listen(ENV.port);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, async () => {
        await ftpConnectionManager.closeAll();
        socketSessionsService.closeAll();
        socketGateway.close();
        process.exit(0);
    });
}
