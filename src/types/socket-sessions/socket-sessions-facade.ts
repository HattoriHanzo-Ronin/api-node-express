import type { AuthUserParams } from "../auth/auth-facade.js";
import type { SocketSessionSubscribeParams } from "./socket-sessions-service.js";

export type SocketSessionFacadeSubscribeParams<Socket> = AuthUserParams & SocketSessionSubscribeParams<Socket>;
