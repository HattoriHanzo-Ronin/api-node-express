import type { WebSocket } from "ws";
import type { Socket } from "node:net";
import type RouterSessionService from "../../services/router-session-service.js";

export type BridgeVncConnectionParams = {
    webSocket: WebSocket;
    sessionId: string;
    token: string;
};

export type NoVncGatewayDependencies = { routerSessionService: RouterSessionService<Socket> };
