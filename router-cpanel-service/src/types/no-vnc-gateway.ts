import type { WebSocket } from "ws";

export type BridgeVncConnectionParams = {
    webSocket: WebSocket;
    sessionId: string;
    token: string;
};
