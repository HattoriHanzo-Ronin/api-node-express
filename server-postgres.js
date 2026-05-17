import { createApp } from "./app.js";
import { DeviceModel } from "./models/postgres/device-model.js";
import { FtpModel } from "./models/ftp/ftp-model.js";

createApp({ devModel: DeviceModel, ftpModel: FtpModel });
