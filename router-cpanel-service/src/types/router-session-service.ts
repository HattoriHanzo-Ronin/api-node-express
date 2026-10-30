export type RouterClientType = "desktop" | "mobile";
export type RouterTheme = "dark" | "light";
export type RouterNavigationAction = "back" | "reload";

export type RouterSessionStatus = {
    loading: boolean;
};

export type RouterSessionStatusListener = (status: RouterSessionStatus) => void;

export type CreateRouterSessionParams = {
    ownerId: string;
    routerName: string;
    routerIp: string;
    routerPassword?: string;
    language?: string;
    clientType?: RouterClientType;
    theme?: RouterTheme;
};

export type RouterSessionResponse = {
    id: string;
    url: string;
    expiresAt: string;
};

export type CloseRouterSessionParams = {
    sessionId: string;
    ownerId?: string;
};

export type NavigateRouterSessionParams = {
    sessionId: string;
    ownerId: string;
    action: RouterNavigationAction;
};

export type RefreshRouterSessionParams = {
    sessionId: string;
};

export type OpenRouterSessionVncSocketParams = {
    sessionId: string;
    token: string;
};

export type SubscribeRouterSessionStatusParams = OpenRouterSessionVncSocketParams & {
    listener: RouterSessionStatusListener;
};

export type MarkRouterSessionInteractionParams = OpenRouterSessionVncSocketParams;
