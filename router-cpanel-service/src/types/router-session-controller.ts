import type { RouterNavigationAction } from "./router-session-service.js";

export type RouterSessionControllerHandlers = {
    create: (...args: never[]) => unknown;
    delete: (...args: never[]) => unknown;
    navigate: (...args: never[]) => unknown;
    streamStatus: (...args: never[]) => unknown;
    markInteraction: (...args: never[]) => unknown;
};

export type CloseRouterSessionBody = {
    ownerId: string;
};

export type NavigateRouterSessionBody = CloseRouterSessionBody & {
    action: RouterNavigationAction;
};

export type RouterSessionViewerQuery = {
    token: string;
};
