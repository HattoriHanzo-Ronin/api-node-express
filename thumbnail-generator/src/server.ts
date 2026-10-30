import { createApp } from "./app.js";
import { ENV } from "./config/environment.js";
import { DefaultThumbnailController } from "./controllers/impl/default-thumbnail-controller.js";
import { DefaultThumbnailService } from "./services/impl/default-thumbnail-service.js";

const { port } = ENV;
const thumbnailController = new DefaultThumbnailController({ thumbnailService: DefaultThumbnailService });
const app = createApp({ thumbnailController });

app.listen(port);
