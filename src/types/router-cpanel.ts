import type {
    ROUTER_CPANEL_ACTION,
    ROUTER_CPANEL_CLIENT_TYPE,
    ROUTER_CPANEL_THEME
} from "../config/constants.js";

export type RouterCpanelAction = (typeof ROUTER_CPANEL_ACTION)[keyof typeof ROUTER_CPANEL_ACTION];
export type RouterCpanelClientType = (typeof ROUTER_CPANEL_CLIENT_TYPE)[keyof typeof ROUTER_CPANEL_CLIENT_TYPE];
export type RouterCpanelTheme = (typeof ROUTER_CPANEL_THEME)[keyof typeof ROUTER_CPANEL_THEME];

/**
 * Router control panel client dependencies
 *
 * @author HattoriHanzo-Ronin
 */
export type RouterCpanelDependencies = {
    routerCpanelServiceUrl: string;
};

export type CreateRouterCpanelParams = {
    ownerId: string;
    routerName: string;
    routerIp: string;
    routerPassword: string;
    language?: string;
    clientType: RouterCpanelClientType;
    theme: RouterCpanelTheme;
};

export type RouterCpanelSession = {
    id: string;
    url: string;
    expiresAt: string;
};

export type NavigateRouterCpanelParams = {
    sessionId: string;
    ownerId: string;
    action: RouterCpanelAction;
};

export type CloseRouterCpanelParams = Omit<NavigateRouterCpanelParams, "action">;
