import type { ChildProcess } from "node:child_process";
import type { Socket } from "node:net";
import type { Browser, HTTPRequest, Page } from "puppeteer-core";
import type { TokenProvider } from "../utils/token-providers/token-provider.js";
import type {
    CreateRouterSessionParams,
    RouterClientType,
    RouterSessionStatusListener
} from "./router-session-service.js";

export type RouterSessionTokenPayload = {
    sid: string;
};

export type RouterSession = {
    id: string;
    ownerId: string;
    routerName: string;
    language?: string;
    display: number;
    vncPort: number;
    profileDir: string | null;
    initialUrl: string | null;
    loading: boolean;
    loadingUntil: number;
    loadingRequests: Set<HTTPRequest>;
    vncConnectionCount: number;
    statusListeners: Set<RouterSessionStatusListener>;
    xvfb?: ChildProcess;
    browser?: Browser;
    page?: Page;
    vnc?: ChildProcess;
    timeout?: NodeJS.Timeout;
    loadingTimeout?: NodeJS.Timeout;
    autoLoginAbort?: AbortController;
};

export type DefaultRouterSessionServiceDependencies = {
    tokenProvider: TokenProvider<RouterSessionTokenPayload>;
};

export type CreateRouterSessionInternalParams = CreateRouterSessionParams & {
    clientType: RouterClientType;
};

export type StartProcessParams = {
    command: string;
    args: string[];
};

export type ConnectVncParams = {
    port: number;
    attempts: number;
    delayMs: number;
};

export type GetViewerUrlParams = {
    id: string;
    token: string;
    routerName: string;
    language?: string;
    clientType: RouterClientType;
    theme?: import("./router-session-service.js").RouterTheme;
};

export type GetRouterSessionParams = { sessionId: string; token: string };
export type ScheduleRouterSessionCloseParams = { session: RouterSession };
export type AutofillRouterPasswordParams = {
    page: Page;
    password: string;
    routerIp: string;
    session: RouterSession;
    signal: AbortSignal;
};
export type FillRouterPasswordParams = { frame: import("puppeteer-core").Frame; password: string };
export type CaptureInitialUrlParams = { page: Page; session: RouterSession; signal: AbortSignal };
export type WatchRouterPageLoadingParams = { page: Page; session: RouterSession };
export type SetRouterSessionLoadingParams = { session: RouterSession; loading: boolean };
export type MarkRouterSessionLoadingParams = { session: RouterSession };
export type CleanupRouterSessionParams = { session: RouterSession };
export type RouterSessionSocket = Socket;
