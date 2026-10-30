import { createApp } from "./app.js";
import { DefaultThumbnailController } from "./controllers/impl/default-thumbnail-controller.js";
import { DefaultThumbnailService } from "./services/impl/default-thumbnail-service.js";

const thumbnailController = new DefaultThumbnailController({ thumbnailService: DefaultThumbnailService });

createApp({ thumbnailController });
