import type { SocketSessionAuthParams, SocketSessionSubscribeParams } from "./socket-sessions-service.js";

export type SocketSessionFacadeSubscribeParams<Socket> = SocketSessionAuthParams & SocketSessionSubscribeParams<Socket>;
