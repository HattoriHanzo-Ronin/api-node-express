import type { AuthUserParams } from "../auth/auth-facade.js";
import type { SocketEntity, SocketSessionSubscribeParams } from "./socket-sessions-service.js";

export type SocketSessionFacadeSubscribeParams<Socket> = AuthUserParams & SocketSessionSubscribeParams<Socket>;

export type SocketSessionsVersionsNotification = { entities: Exclude<SocketEntity, "ftp">[] };
