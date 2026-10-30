import type { RequestHandler } from "express";
import type { CreateRouterSessionParams, RouterSessionResponse } from "./router-session-service.js";
import type {
    CloseRouterSessionBody,
    NavigateRouterSessionBody,
    RouterSessionViewerQuery
} from "./router-session-controller.js";

export type ExpressRouterSessionControllerHandlers = {
    create: RequestHandler<never, RouterSessionResponse, CreateRouterSessionParams>;
    delete: RequestHandler<{ sessionId: string }, void, CloseRouterSessionBody>;
    navigate: RequestHandler<{ sessionId: string }, void, NavigateRouterSessionBody>;
    streamStatus: RequestHandler<{ sessionId: string }, void, never, RouterSessionViewerQuery>;
    markInteraction: RequestHandler<{ sessionId: string }, void, never, RouterSessionViewerQuery>;
};
