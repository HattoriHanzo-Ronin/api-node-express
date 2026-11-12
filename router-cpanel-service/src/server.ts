import { createServer } from "node:http";
import createApp from "./app.js";
import { ENV } from "./config/environment.js";
import { SECRETS } from "./config/secrets.js";
import RouterSessionController from "./controllers/router-session-controller.js";
import DefaultRouterSessionService from "./services/impl/default-router-session-service.js";
import type { RouterSessionTokenPayload } from "./types/router-session/default-router-session-service.js";
import JwtProvider from "./utils/token-providers/impl/jwt-provider.js";
import NoVncGateway from "./utils/gateways/impl/no-vnc-gateway.js";
import Logger from "./utils/logger/logger.js";
import { LOG_EVENT } from "./config/log-events.js";

const { jwtAccessTokenExpiresIn, port } = ENV;
const logger = Logger.getLogger({ name: "server" });
const tokenProvider = new JwtProvider<RouterSessionTokenPayload>({
    secret: SECRETS.jwtSecret,
    expiresIn: jwtAccessTokenExpiresIn
});
const routerSessionService = new DefaultRouterSessionService({ tokenProvider });
const routerSessionController = new RouterSessionController({ routerSessionService });
const vncGateway = new NoVncGateway({ routerSessionService });
const app = createApp({ routerSessionController });
const server = createServer(app);

vncGateway.attach({ server });
server.listen(port, () => logger.info({ event: LOG_EVENT.serviceStarted, message: "Router panel service started" }));

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => shutdown());
}

async function shutdown(): Promise<void> {
    vncGateway.close();
    await routerSessionService.closeAll();
    server.close();
}
