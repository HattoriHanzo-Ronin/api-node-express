import { createApp } from "./app.js";

import PostgresClient from "./config/db/postgres-client.js";

import FtpController from "./controllers/ftp-controller.js";
import FtpService from "./services/ftp-service.js";
import FtpMapper from "./mappers/ftp-mapper.js";
import FtpFacade from "./facades/ftp-facade.js";
import MemoryCache from "./cache/memory-cache.js";
import DataVersionsModel from "./models/postgres/data-versions-model.js";
import DataVersionsService from "./services/data-versions-service.js";
import DataVersionsController from "./controllers/data-versions-controller.js";

import ConnectionsModel from "./models/postgres/connections-model.js";
import ConnectionsService from "./services/connections-service.js";
import DevicesModel from "./models/postgres/devices-model.js";
import DevicesService from "./services/devices-service.js";
import DevicesMapper from "./mappers/devices-mapper.js";
import DevicesFacade from "./facades/devices-facade.js";
import DevicesController from "./controllers/devices-controller.js";
import WhitelistModel from "./models/postgres/whitelist-model.js";
import WhitelistService from "./services/whitelist-service.js";
import WhitelistFacade from "./facades/whitelist-facade.js";
import WhitelistController from "./controllers/whitelist-controller.js";

import UserRolesModel from "./models/postgres/user-roles-model.js";
import UserRolesService from "./services/user-roles-service.js";
import UsersModel from "./models/postgres/users-model.js";
import UsersMapper from "./mappers/users-mapper.js";
import UsersService from "./services/users-service.js";
import UsersFacade from "./facades/users-facade.js";
import UsersController from "./controllers/users-controller.js";
import RefreshTokensModel from "./models/postgres/refresh-tokens-model.js";
import RefreshTokensService from "./services/refresh-tokens-service.js";
import AuthFacade from "./facades/auth-facade.js";
import AuthController from "./controllers/auth-controller.js";

const tx = PostgresClient.executeTx;

const dataVersionsService = new DataVersionsService({ dataVersionsModel: DataVersionsModel });
const memoryCache = new MemoryCache();
const ftpFacade = new FtpFacade({
    ftpService: FtpService,
    dataVersionsService,
    ftpMapper: FtpMapper,
    memoryCache,
    tx
});
const ftpController = new FtpController({ ftpFacade });
const dataVersionsController = new DataVersionsController({ dataVersionsService });

const connectionsService = new ConnectionsService({ connectionsModel: ConnectionsModel });
const devicesService = new DevicesService({ devicesModel: DevicesModel });
const devicesFacade = new DevicesFacade({
    devicesService,
    dataVersionsService,
    devicesMapper: DevicesMapper,
    connectionsService,
    tx
});
const devicesController = new DevicesController({ devicesFacade });
const whitelistService = new WhitelistService({ whitelistModel: WhitelistModel });
const whitelistFacade = new WhitelistFacade({ whitelistService, devicesFacade, tx });
const whitelistController = new WhitelistController({ whitelistFacade });

const userRolesService = new UserRolesService({ userRolesModel: UserRolesModel });
const usersService = new UsersService({ usersModel: UsersModel });
const usersFacade = new UsersFacade({ usersService, dataVersionsService, userRolesService, usersMapper: UsersMapper, tx });
const usersController = new UsersController({ usersFacade });
const refreshTokensService = new RefreshTokensService({ refreshTokensModel: RefreshTokensModel });
const authFacade = new AuthFacade({ usersFacade, refreshTokensService });
const authController = new AuthController({ authFacade });

createApp({
    dataVersionsController,
    ftpController,
    whitelistController,
    devicesController,
    usersController,
    authController
});
