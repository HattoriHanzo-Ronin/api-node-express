import { createApp } from "./app.js";

import PostgresClient from "./config/db/postgres-client.js";
import FtpConnection from "./config/ftp-connection.js";

import FtpController from "./controllers/ftp-controller.js";
import FtpService from "./services/ftp-service.js";

import WhitelistModel from "./models/postgres/whitelist-model.js";
import WhitelistService from "./services/whitelist-service.js";
import WhitelistController from "./controllers/whitelist-controller.js";
import DeviceModel from "./models/postgres/device-model.js";
import DeviceService from "./services/device-service.js";
import DeviceController from "./controllers/device-controller.js";

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
const whitelistController = new WhitelistController({ whitelistService });
const deviceService = new DeviceService({ deviceModel: DeviceModel, whitelistService });
const deviceController = new DeviceController({ deviceService });

const userRolesService = new UserRolesService({ userRolesModel: UserRolesModel });
const usersService = new UsersService({ usersModel: UsersModel });
const usersFacade = new UsersFacade({ usersService, userRolesService, usersMapper: UsersMapper, tx });
const usersController = new UsersController({ usersFacade });
const refreshTokensService = new RefreshTokensService({ refreshTokensModel: RefreshTokensModel });
const authFacade = new AuthFacade({ usersFacade, refreshTokensService });
const authController = new AuthController({ authFacade });

createApp({ ftpController, whitelistController, deviceController, usersController, authController });
