import createApp from "./app.js";
import { ENV } from "./config/environment.js";
import ThumbnailController from "./controllers/thumbnail-controller.js";
import DefaultThumbnailService from "./services/impl/default-thumbnail-service.js";

const { port } = ENV;
const thumbnailService = new DefaultThumbnailService();
const thumbnailController = new ThumbnailController({ thumbnailService });
const app = createApp({ thumbnailController });

app.listen(port);
