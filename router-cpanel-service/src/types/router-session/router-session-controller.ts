import type { RequestHandler } from "express";
import type RouterSessionService from "../../services/router-session-service.js";
import type {
    CreateRouterSessionParams,
    RouterSessionResponse,
    RouterNavigationAction
} from "./router-session-service.js";

export type CloseRouterSessionBody = {
    ownerId: string;
};

export type NavigateRouterSessionBody = CloseRouterSessionBody & {
    action: RouterNavigationAction;
};

export type RouterSessionViewerQuery = {
    token: string;
};

export type RouterSessionControllerDependencies = { routerSessionService: RouterSessionService<unknown> };
export type CreateRouterSessionHandler = RequestHandler<never, RouterSessionResponse, CreateRouterSessionParams>;
export type DeleteRouterSessionHandler = RequestHandler<{ sessionId: string }, void, CloseRouterSessionBody>;
export type NavigateRouterSessionHandler = RequestHandler<{ sessionId: string }, void, NavigateRouterSessionBody>;
export type StreamRouterSessionStatusHandler = RequestHandler<
    { sessionId: string },
    void,
    never,
    RouterSessionViewerQuery
>;
export type MarkRouterSessionInteractionHandler = StreamRouterSessionStatusHandler;
