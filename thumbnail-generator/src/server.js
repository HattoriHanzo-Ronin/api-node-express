import { createApp } from "./app.js";
import ThumbnailController from "./controllers/thumbnail-controller.js";
import ThumbnailService from "./services/thumbnail-service.js";

const thumbnailController = new ThumbnailController({ thumbnailService: ThumbnailService });

createApp({ thumbnailController });
