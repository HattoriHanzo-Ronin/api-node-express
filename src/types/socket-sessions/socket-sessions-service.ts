import type { AuthUserParams } from "../auth/auth-facade.js";
import type { SOCKET_ENTITY } from "../../config/constants.js";

export type SocketEntity = (typeof SOCKET_ENTITY)[keyof typeof SOCKET_ENTITY];
export type SocketSessionId = Pick<SocketSessionResponse, "id">;
export type SocketSessionOwnedParams = AuthUserParams & SocketSessionId;
export type SocketSessionConnectionParams<Socket> = SocketSessionId & { webSocket: Socket };
export type SocketSessionConnectParams<Socket> = SocketSessionOwnedParams & SocketSessionConnectionParams<Socket>;
export type SocketSessionSubscribeParams<Socket> = SocketSessionConnectionParams<Socket> & { entities: SocketEntity[] };
export type SocketSessionNotification = { entity: SocketEntity; data?: object; ownerId?: string };
export type SocketSessionResponse = { id: string; expiresAt: string };
