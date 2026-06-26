import { createApp } from "./app.js";

import PostgresClient from "./config/db/postgres-client.js";

import FtpController from "./controllers/ftp-controller.js";
import FtpService from "./services/ftp-service.js";

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

const ftpController = new FtpController({ ftpService: FtpService });

const whitelistService = new WhitelistService({ whitelistModel: WhitelistModel });
const devicesService = new DevicesService({ devicesModel: DevicesModel });
const devicesFacade = new DevicesFacade({ devicesService, devicesMapper: DevicesMapper, tx });
const devicesController = new DevicesController({ devicesFacade });
const whitelistFacade = new WhitelistFacade({ whitelistService, devicesService, tx });
const whitelistController = new WhitelistController({ whitelistFacade });

const userRolesService = new UserRolesService({ userRolesModel: UserRolesModel });
const usersService = new UsersService({ usersModel: UsersModel });
const usersFacade = new UsersFacade({ usersService, userRolesService, usersMapper: UsersMapper, tx });
const usersController = new UsersController({ usersFacade });
const refreshTokensService = new RefreshTokensService({ refreshTokensModel: RefreshTokensModel });
const authFacade = new AuthFacade({ usersFacade, refreshTokensService });
const authController = new AuthController({ authFacade });

createApp({ ftpController, whitelistController, devicesController, usersController, authController });
