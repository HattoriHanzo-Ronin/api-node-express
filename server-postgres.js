import { createApp } from "./app.js";
import FtpConnection from "./config/ftp-connection.js";
import FtpController from "./controllers/ftp-controller.js";
import FtpService from "./services/ftp-service.js";
import WhitelistModel from "./models/postgres/whitelist-model.js";
import WhitelistService from "./services/whitelist-service.js";
import WhitelistController from "./controllers/whitelist-controller.js";

const ftpController = new FtpController({ ftpService: FtpService });
const whitelistService = new WhitelistService({ whitelistModel: WhitelistModel });
const whitelistController = new WhitelistController({ whitelistService });
createApp({ ftpController, whitelistController });
