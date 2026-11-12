import createApp from "./app.js";
import { ENV } from "./config/environment.js";
import ThumbnailController from "./controllers/thumbnail-controller.js";
import DefaultThumbnailService from "./services/impl/default-thumbnail-service.js";
import { LOG_EVENT } from "./config/log-events.js";
import Logger from "./utils/logger/logger.js";

const { port } = ENV;
const logger = Logger.getLogger({ name: "server" });
const thumbnailService = new DefaultThumbnailService();
const thumbnailController = new ThumbnailController({ thumbnailService });
const app = createApp({ thumbnailController });

app.listen(port, () => logger.info({ event: LOG_EVENT.serviceStarted, message: "Thumbnail service started" }));
