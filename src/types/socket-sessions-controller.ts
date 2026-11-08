import type { RequestHandler } from "express";
import type { WebSocket } from "ws";
import type SocketSessionsFacade from "../facades/socket-sessions-facade.js";
import type { SocketSessionResponse } from "./socket-sessions-service.js";

export type SocketSessionsControllerDependencies = { socketSessionsFacade: SocketSessionsFacade<WebSocket> };
export type SocketSessionCreateHandler = RequestHandler<Record<string, string>, SocketSessionResponse>;
export type SocketSessionRefreshHandler = RequestHandler<{ id: string }, SocketSessionResponse>;
export type SocketSessionCloseHandler = RequestHandler<{ id: string }>;
