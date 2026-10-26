import { createServer } from "node:http";
import { createApp } from "./app.js";
import { ENV } from "./config/environment.js";
import RouterSessionController from "./controllers/router-session-controller.js";
import RouterSessionService from "./services/router-session-service.js";
import VncGateway from "./utils/gateways/vnc-gateway.js";

const routerSessionService = new RouterSessionService();
const routerSessionController = new RouterSessionController({ routerSessionService });
const vncGateway = new VncGateway({ routerSessionService });
const app = createApp({ routerSessionController });
const server = createServer(app);

vncGateway.attach({ server });
server.listen(ENV.port);

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => shutdown());
}

async function shutdown() {
    vncGateway.close();
    await routerSessionService.closeAll();
    server.close();
}
