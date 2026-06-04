import { createApp } from "./app.js";
import FtpConnection from "./config/ftp-connection.js";
import FtpController from "./controllers/ftp-controller.js";
import FtpService from "./services/ftp-service.js";
import WhitelistModel from "./models/postgres/whitelist-model.js";
import WhitelistService from "./services/whitelist-service.js";
import WhitelistController from "./controllers/whitelist-controller.js";
import DeviceModel from "./models/postgres/device-model.js";
import DeviceService from "./services/device-service.js";
import DeviceController from "./controllers/device-controller.js";

const ftpController = new FtpController({ ftpService: FtpService });
const whitelistService = new WhitelistService({ whitelistModel: WhitelistModel });
const whitelistController = new WhitelistController({ whitelistService });
const deviceService = new DeviceService({ deviceModel: DeviceModel, whitelistService });
const deviceController = new DeviceController({ deviceService });

createApp({ ftpController, whitelistController, deviceController });
