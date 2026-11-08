import type { WebSocket, RawData } from "ws";
import type SocketSessionsFacade from "../../facades/socket-sessions-facade.js";
import type TokenProvider from "../../utils/token-providers/token-provider.js";
import type { AuthAccessTokenPayload, VerifiedAccessToken } from "../auth/auth-facade.js";

type WebSocketParam = {
    webSocket: WebSocket;
};

/**
 * Socket events gateway dependencies
 *
 * @author HattoriHanzo-Ronin
 */
export type SocketEventsGatewayDependencies = {
    socketSessionsFacade: SocketSessionsFacade<WebSocket>;
    accessTokenProvider: TokenProvider<AuthAccessTokenPayload, VerifiedAccessToken>;
};

export type SocketEventsMessagesParams = {
    sessionId: string;
} & WebSocketParam;

export type SocketEventsSendError = {
    err: unknown;
} & WebSocketParam;

export type SocketEventsGetMessage = {
    data: RawData;
    isBinary: boolean;
};

export type SocketEventsMessage = {
    accessToken: string;
    entities: unknown;
};
