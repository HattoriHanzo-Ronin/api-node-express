import { createServer } from "node:http";
import { createApp } from "./app.js";
import { ENV } from "./config/environment.js";
import { SECRETS } from "./config/secrets.js";
import { DefaultRouterSessionController } from "./controllers/impl/default-router-session-controller.js";
import { DefaultRouterSessionService } from "./services/impl/default-router-session-service.js";
import { JwtProvider } from "./utils/token-providers/impl/jwt-provider.js";
import { NoVncGateway } from "./utils/gateways/impl/no-vnc-gateway.js";

const { jwtAccessTokenExpiresIn, port } = ENV;
const tokenProvider = new JwtProvider({ secret: SECRETS.jwtSecret, expiresIn: jwtAccessTokenExpiresIn });
const routerSessionService = new DefaultRouterSessionService({ tokenProvider });
const routerSessionController = new DefaultRouterSessionController({ routerSessionService });
const vncGateway = new NoVncGateway({ routerSessionService });
const app = createApp({ routerSessionController });
const server = createServer(app);

vncGateway.attach({ server });
server.listen(port);

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => shutdown());
}

async function shutdown() {
    vncGateway.close();
    await routerSessionService.closeAll();
    server.close();
}
