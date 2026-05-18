import { createApp } from "./app.js";
import FtpConnection from "./config/ftp-connection.js";
import FtpController from "./controllers/ftp-controller.js";
import FtpService from "./services/ftp-service.js";

const ftpController = new FtpController({ ftpService: FtpService });
createApp({ ftpController });
