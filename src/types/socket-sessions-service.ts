import type { VerifiedAccessToken } from "./auth.js";
import type { SOCKET_ENTITY } from "../config/constants.js";

export type SocketEntity = (typeof SOCKET_ENTITY)[keyof typeof SOCKET_ENTITY];
export type SocketSessionAuthParams = { authUser: VerifiedAccessToken };
export type SocketSessionId = { id: string };
export type SocketSessionOwnedParams = SocketSessionAuthParams & SocketSessionId;
export type SocketSessionConnectionParams<Socket> = SocketSessionId & { webSocket: Socket };
export type SocketSessionConnectParams<Socket> = SocketSessionOwnedParams & SocketSessionConnectionParams<Socket>;
export type SocketSessionSubscribeParams<Socket> = SocketSessionConnectionParams<Socket> & { entities: SocketEntity[] };
export type SocketSessionNotification = { entity: string; data?: object; ownerId?: string };
export type SocketSessionResponse = { id: string; expiresAt: string };
