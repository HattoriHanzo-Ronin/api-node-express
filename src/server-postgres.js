import { createServer } from "node:http";
import { createApp } from "./app.js";

import PostgresClient from "./utils/connection/postgres/postgres-client.js";
import PostgresErrors from "./utils/error/postgres/postgres-errors.js";

import FtpController from "./controllers/ftp-controller.js";
import FtpService from "./services/ftp-service.js";
import { FtpConnectionManager } from "./utils/connection/ftp/manager/ftp-connection-manager.js";
import FtpMapper from "./mappers/ftp-mapper.js";
import FtpFacade from "./facades/ftp-facade.js";
import MemoryCache from "./utils/cache/memory-cache.js";
import DirectoryCache from "./utils/cache/directory-cache.js";
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
import RouterAutomation from "./utils/devices-routers/automation/router-automation.js";
import RouterCpanel from "./utils/devices-routers/cpanel/router-cpanel.js";
import WhitelistModel from "./models/postgres/whitelist/whitelist-model.js";
import WhitelistService from "./services/whitelist-service.js";
import WhitelistFacade from "./facades/whitelist-facade.js";
import WhitelistController from "./controllers/whitelist-controller.js";

import UserRolesModel from "./models/postgres/user-roles/user-roles-model.js";
import UserRolesService from "./services/user-roles-service.js";
import UserRolesMapper from "./mappers/user-roles-mapper.js";
import UserRolesFacade from "./facades/user-roles-facade.js";
import UsersModel from "./models/postgres/users/users-model.js";
import UsersMapper from "./mappers/users-mapper.js";
import UsersService from "./services/users-service.js";
import UsersFacade from "./facades/users-facade.js";
import UsersController from "./controllers/users-controller.js";
import RefreshTokensModel from "./models/postgres/refresh-tokens/refresh-tokens-model.js";
import RefreshTokensService from "./services/refresh-tokens-service.js";
import AuthFacade from "./facades/auth-facade.js";
import AuthController from "./controllers/auth-controller.js";
import { ENV } from "./config/environment.js";
import { SECRETS } from "./config/secrets.js";
import JwtTokenProvider from "./utils/token-providers/jwt-token-provider.js";
import SocketSessionsService from "./services/socket-sessions-service.js";
import SocketSessionsController from "./controllers/socket-sessions-controller.js";
import SocketSessionsFacade from "./facades/socket-sessions-facade.js";
import SocketGateway from "./utils/gateways/socket-gateway.js";

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

const memoryCache = new MemoryCache();
const directoryCache = new DirectoryCache();
const ftpConnectionManager = new FtpConnectionManager();
const ftpService = new FtpService({ ftpConnectionManager });
const ftpFacade = new FtpFacade({ ftpService, ftpMapper: FtpMapper, memoryCache, directoryCache });
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
const routerCpanel = new RouterCpanel({ routerCpanelServiceUrl });
const devicesFacade = new DevicesFacade({
    devicesService,
    dataVersionsFacade,
    devicesMapper,
    connectionsFacade,
    routerAutomation,
    routerCpanel,
    tx
});
const devicesController = new DevicesController({ devicesFacade });

const whitelistService = new WhitelistService({ whitelistModel: WhitelistModel, entityError: whitelistEntityError });
const whitelistFacade = new WhitelistFacade({ whitelistService, devicesFacade, routerAutomation, tx });
const whitelistController = new WhitelistController({ whitelistFacade });

const userRolesService = new UserRolesService({ userRolesModel: UserRolesModel });
const userRolesFacade = new UserRolesFacade({
    userRolesService,
    userRolesMapper: UserRolesMapper
});

const usersService = new UsersService({ usersModel: UsersModel, entityError: usersEntityError });
const usersFacade = new UsersFacade({
    usersService,
    dataVersionsFacade,
    userRolesFacade,
    usersMapper: UsersMapper,
    tx
});
const usersController = new UsersController({ usersFacade });

const refreshTokensService = new RefreshTokensService({
    refreshTokensModel: RefreshTokensModel,
    entityError: refreshTokensEntityError
});

const socketSessionsService = new SocketSessionsService();
const socketSessionsFacade = new SocketSessionsFacade({ socketSessionsService, dataVersionsFacade });
const socketSessionsController = new SocketSessionsController({ socketSessionsFacade });

const accessTokenProvider = new JwtTokenProvider({ secret: jwtSecret, expiresIn: jwtAccessTokenExpiresIn });
const refreshTokenProvider = new JwtTokenProvider({ secret: refreshJwtSecret, expiresIn: jwtRefreshTokenExpiresIn });
const socketGateway = new SocketGateway({ socketSessionsFacade, accessTokenProvider });
const authFacade = new AuthFacade({
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

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, async () => {
        await ftpConnectionManager.closeAll();
        socketSessionsService.closeAll();
        socketGateway.close();
        process.exit(0);
    });
}
