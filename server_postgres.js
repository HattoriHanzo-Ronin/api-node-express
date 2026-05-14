import { createApp } from "./app.js";
import { DeviceModel } from "./models/postgres/device.js";
import { FtpModel } from "./models/ftp/ftp.js";

createApp({ devModel : DeviceModel, ftpModel : FtpModel })