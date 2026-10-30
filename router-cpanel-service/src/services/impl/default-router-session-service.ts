import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import type { HTTPRequest } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer-core";
import { ENV } from "../../config/environment.js";
import { API_ERROR } from "../../config/errors.js";
import type { RouterSessionService } from "../router-session-service.js";
import type {
    CloseRouterSessionParams,
    CreateRouterSessionParams,
    MarkRouterSessionInteractionParams,
    NavigateRouterSessionParams,
    OpenRouterSessionVncSocketParams,
    RefreshRouterSessionParams,
    RouterSessionResponse,
    SubscribeRouterSessionStatusParams
} from "../../types/router-session-service.js";
import type {
    AutofillRouterPasswordParams,
    CaptureInitialUrlParams,
    CleanupRouterSessionParams,
    ConnectVncParams,
    CreateRouterSessionInternalParams,
    DefaultRouterSessionServiceDependencies,
    FillRouterPasswordParams,
    GetRouterSessionParams,
    GetViewerUrlParams,
    MarkRouterSessionLoadingParams,
    RouterSession,
    RouterSessionSocket,
    ScheduleRouterSessionCloseParams,
    SetRouterSessionLoadingParams,
    StartProcessParams,
    WatchRouterPageLoadingParams
} from "../../types/default-router-session-service.js";
import ApiError from "../../utils/error/api-error.js";

const {
    chromePath,
    displayBase,
    maxActiveUsers,
    maxSessionsPerUser,
    maxVncConnectionsPerSession,
    publicUrl,
    sessionInactivityTimeout,
    vncPortBase
} = ENV;
const {
    routerSessionCapacityReached,
    routerSessionConnectionCapacityReached,
    routerSessionFailed,
    routerSessionInvalid,
    routerSessionNotFound
} = API_ERROR;

/**
 * Manages isolated visible browser sessions for router control panels
 *
 * @author HattoriHanzo-Ronin
 */
export class DefaultRouterSessionService implements RouterSessionService<RouterSessionSocket> {
    private static readonly PASSWORD_SELECTOR =
        'input[type="password"], input[name="password"], input[name="Password"]';
    private static readonly SUBMIT_SELECTOR =
        'button[type="submit"], input[type="submit"], button:not([type]), .login_button, button.login-btn, button[data-cy="loginBtn"], input#loginSub, input.subBtn';
    private static readonly AUTO_LOGIN_INTERVAL = 250;
    private static readonly AUTO_LOGIN_TIMEOUT = 10_000;
    private static readonly LOADING_CLEAR_DELAY = 200;
    private static readonly LOADING_INTERACTION_TIMEOUT = 1_500;
    private static readonly LOADING_RESOURCE_TYPES = ["document", "fetch", "xhr"] as const;
    private static readonly VNC_CONNECTION_ATTEMPTS = 50;
    private static readonly VNC_CONNECTION_DELAY = 100;
    private static readonly VIEWPORTS = {
        desktop: { width: 1440, height: 900 },
        mobile: { width: 900, height: 1600 }
    } as const;

    private readonly tokenProvider: DefaultRouterSessionServiceDependencies["tokenProvider"];
    private readonly sessions = new Map<string, RouterSession>();
    private readonly ownerSessions = new Map<string, Set<string>>();
    private readonly ownerLocks = new Map<string, Promise<void>>();
    private readonly pendingOwners = new Set<string>();
    private nextDisplay = displayBase;

    constructor({ tokenProvider }: DefaultRouterSessionServiceDependencies) {
        this.tokenProvider = tokenProvider;
    }

    async create({
        ownerId,
        routerName,
        routerIp,
        routerPassword,
        language,
        clientType = "desktop",
        theme
    }: CreateRouterSessionParams): Promise<RouterSessionResponse> {
        return this.createForOwner({ ownerId, routerName, routerIp, routerPassword, language, clientType, theme });
    }

    async close({ sessionId, ownerId }: CloseRouterSessionParams): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        ApiError.handle([
            {
                condition: ownerId !== undefined && session.ownerId !== ownerId,
                message: "La sesión de panel de router no existe",
                status: 404,
                apiError: routerSessionNotFound
            }
        ]);

        this.sessions.delete(sessionId);
        const ownerSessions = this.ownerSessions.get(session.ownerId);
        ownerSessions?.delete(sessionId);
        if (ownerSessions?.size === 0) {
            this.ownerSessions.delete(session.ownerId);
        }

        try {
            await this.cleanupSession({ session });
        } catch {
            throw new ApiError({
                message: "No se ha podido cerrar la sesión del panel de router",
                apiError: routerSessionFailed
            });
        }
    }

    async navigate({ sessionId, ownerId, action }: NavigateRouterSessionParams): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session || session.ownerId !== ownerId) {
            throw new ApiError({
                message: "La sesión de panel de router no existe",
                status: 404,
                apiError: routerSessionNotFound
            });
        }

        try {
            const { page } = session;
            if (!page) {
                throw new Error("La página de la sesión no está disponible");
            }

            switch (action) {
                case "back":
                    if (!session.initialUrl || page.url() === session.initialUrl) {
                        return;
                    }

                    await page.goBack({ waitUntil: "domcontentloaded", timeout: 30_000 });
                    return;
                case "reload":
                    this.markLoadingInteraction({ session });
                    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
            }
        } catch {
            throw new ApiError({
                message: "No se ha podido navegar en el panel de router",
                apiError: routerSessionFailed
            });
        }
    }

    refresh({ sessionId }: RefreshRouterSessionParams): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        this.scheduleClose({ session });
    }

    async openVncSocket({
        sessionId,
        token
    }: OpenRouterSessionVncSocketParams): ReturnType<RouterSessionService<RouterSessionSocket>["openVncSocket"]> {
        const session = this.getSession({ sessionId, token });
        ApiError.handle([
            {
                condition: session.vncConnectionCount >= maxVncConnectionsPerSession,
                message: "La sesión de panel de router ya tiene el máximo de conexiones VNC",
                status: 429,
                apiError: routerSessionConnectionCapacityReached
            }
        ]);

        session.vncConnectionCount += 1;
        this.scheduleClose({ session });
        try {
            const vncSocket = await DefaultRouterSessionService.connectVnc({
                port: session.vncPort,
                attempts: DefaultRouterSessionService.VNC_CONNECTION_ATTEMPTS,
                delayMs: DefaultRouterSessionService.VNC_CONNECTION_DELAY
            });
            vncSocket.once("close", () => {
                session.vncConnectionCount -= 1;
            });
            return vncSocket;
        } catch {
            session.vncConnectionCount -= 1;
            throw new ApiError({
                message: "No se ha podido abrir la conexión VNC",
                apiError: routerSessionFailed
            });
        }
    }

    subscribe({ sessionId, token, listener }: SubscribeRouterSessionStatusParams): () => boolean {
        const session = this.getSession({ sessionId, token });
        session.statusListeners.add(listener);
        listener({ loading: session.loading });
        return () => session.statusListeners.delete(listener);
    }

    markInteraction({ sessionId, token }: MarkRouterSessionInteractionParams): void {
        const session = this.getSession({ sessionId, token });
        this.markLoadingInteraction({ session });
    }

    async closeAll(): Promise<void> {
        await Promise.allSettled([...this.sessions.keys()].map((sessionId) => this.close({ sessionId })));
    }

    private async createForOwner({
        ownerId,
        routerName,
        routerIp,
        routerPassword,
        language,
        clientType,
        theme
    }: CreateRouterSessionInternalParams): Promise<RouterSessionResponse> {
        const previous = this.ownerLocks.get(ownerId) ?? Promise.resolve();
        let release: () => void = () => {};
        const lock = new Promise<void>((resolve) => {
            release = resolve;
        });
        this.ownerLocks.set(ownerId, lock);
        await previous;
        try {
            const ownerSessions = this.ownerSessions.get(ownerId) ?? new Set();
            const activeOwners = new Set([...this.ownerSessions.keys(), ...this.pendingOwners]);
            ApiError.handle([
                {
                    condition: ownerSessions.size === 0 && activeOwners.size >= maxActiveUsers,
                    message: "Se ha alcanzado el número máximo de sesiones activas",
                    status: 429,
                    apiError: routerSessionCapacityReached
                }
            ]);
            this.pendingOwners.add(ownerId);
            if (ownerSessions.size >= maxSessionsPerUser) {
                await Promise.all([...ownerSessions].map((sessionId) => this.close({ sessionId })));
            }

            return await this.createSession({
                ownerId,
                routerName,
                routerIp,
                routerPassword,
                language,
                clientType,
                theme
            });
        } finally {
            this.pendingOwners.delete(ownerId);
            release();
            if (this.ownerLocks.get(ownerId) === lock) {
                this.ownerLocks.delete(ownerId);
            }
        }
    }

    private async createSession({
        ownerId,
        routerName,
        routerIp,
        routerPassword,
        language,
        clientType,
        theme
    }: CreateRouterSessionInternalParams): Promise<RouterSessionResponse> {
        const id = randomUUID();
        const token = this.tokenProvider.create({ payload: { sid: id } });
        const display = this.nextDisplay;
        this.nextDisplay += 1;
        const vncPort = vncPortBase + display - displayBase;
        const { width, height } = DefaultRouterSessionService.VIEWPORTS[clientType];
        const session: RouterSession = {
            id,
            ownerId,
            routerName,
            language,
            display,
            vncPort,
            profileDir: null,
            initialUrl: null,
            loading: false,
            loadingUntil: 0,
            loadingRequests: new Set(),
            vncConnectionCount: 0,
            statusListeners: new Set()
        };
        try {
            session.profileDir = await mkdtemp(path.join(tmpdir(), "router-cpanel-"));
            session.xvfb = await DefaultRouterSessionService.startProcess({
                command: "Xvfb",
                args: [`:${display}`, "-screen", "0", `${width}x${height}x24`, "-nolisten", "tcp"]
            });
            session.browser = await puppeteer.launch({
                executablePath: chromePath,
                headless: false,
                ignoreDefaultArgs: ["--enable-automation"],
                userDataDir: session.profileDir,
                env: {
                    ...process.env,
                    DISPLAY: `:${display}`,
                    HOME: session.profileDir,
                    XDG_CACHE_HOME: `${session.profileDir}/cache`,
                    XDG_CONFIG_HOME: `${session.profileDir}/config`,
                    XDG_DATA_HOME: `${session.profileDir}/data`,
                    XDG_RUNTIME_DIR: session.profileDir
                },
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-infobars",
                    "--kiosk",
                    "--window-position=0,0",
                    `--window-size=${width},${height}`
                ]
            });
            const [initialPage] = await session.browser.pages();
            const page = initialPage ?? (await session.browser.newPage());
            session.page = page;
            this.watchPageLoading({ page, session });
            await page.setViewport({ width, height });
            await page.goto(`http://${routerIp}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
            if (routerPassword === undefined) {
                session.initialUrl = page.url();
            }

            session.vnc = await DefaultRouterSessionService.startProcess({
                command: "x11vnc",
                args: ["-display", `:${display}`, "-localhost", "-forever", "-shared", "-rfbport", String(vncPort)]
            });
            this.sessions.set(id, session);
            const ownerSessions = this.ownerSessions.get(ownerId) ?? new Set();
            ownerSessions.add(id);
            this.ownerSessions.set(ownerId, ownerSessions);
            this.scheduleClose({ session });
            if (routerPassword !== undefined) {
                session.autoLoginAbort = new AbortController();
                void this.autofillPassword({
                    page,
                    password: routerPassword,
                    routerIp,
                    session,
                    signal: session.autoLoginAbort.signal
                }).catch(() => {});
            }

            return {
                id,
                url: DefaultRouterSessionService.getViewerUrl({ id, token, routerName, language, clientType, theme }),
                expiresAt: new Date(Date.now() + sessionInactivityTimeout).toISOString()
            };
        } catch {
            await this.cleanupSession({ session }).catch(() => {});
            throw new ApiError({
                message: "No se ha podido crear la sesión del panel de router",
                apiError: routerSessionFailed
            });
        }
    }

    private scheduleClose({ session }: ScheduleRouterSessionCloseParams): void {
        clearTimeout(session.timeout);
        const timeout = setTimeout(
            () => void this.close({ sessionId: session.id }).catch(() => {}),
            sessionInactivityTimeout
        );
        timeout.unref();
        session.timeout = timeout;
    }

    private async autofillPassword({
        page,
        password,
        routerIp,
        session,
        signal
    }: AutofillRouterPasswordParams): Promise<void> {
        while (!signal.aborted) {
            if (new URL(page.url()).hostname === routerIp) {
                const results = await Promise.all(
                    page.frames().map((frame) => this.fillPassword({ frame, password }).catch(() => false))
                );
                const filled = results.some(Boolean);
                if (filled) {
                    await this.captureInitialUrl({ page, session, signal });
                    return;
                }
            }

            await delay(DefaultRouterSessionService.AUTO_LOGIN_INTERVAL, undefined, { signal }).catch(() => {});
        }
    }

    private async fillPassword({ frame, password }: FillRouterPasswordParams): Promise<boolean> {
        return frame.evaluate(
            ({
                password,
                passwordSelector,
                submitSelector
            }: {
                password: string;
                passwordSelector: string;
                submitSelector: string;
            }) => {
                const passwordInput = document.querySelector(passwordSelector);
                if (!(passwordInput instanceof HTMLInputElement)) {
                    return false;
                }

                const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
                valueSetter?.call(passwordInput, password);
                passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
                passwordInput.dispatchEvent(new Event("change", { bubbles: true }));
                const form = passwordInput.closest("form");
                setTimeout(() => {
                    const submitButton = form?.querySelector(submitSelector) ?? document.querySelector(submitSelector);
                    if (submitButton instanceof HTMLElement) {
                        submitButton.click();
                    }
                }, 100);
                return true;
            },
            {
                password,
                passwordSelector: DefaultRouterSessionService.PASSWORD_SELECTOR,
                submitSelector: DefaultRouterSessionService.SUBMIT_SELECTOR
            }
        );
    }

    private async captureInitialUrl({ page, session, signal }: CaptureInitialUrlParams): Promise<void> {
        const loginUrl = page.url();
        const timeout = Date.now() + DefaultRouterSessionService.AUTO_LOGIN_TIMEOUT;
        while (!signal.aborted && Date.now() < timeout) {
            await delay(DefaultRouterSessionService.AUTO_LOGIN_INTERVAL, undefined, { signal }).catch(() => {});
            const frames = page.frames();
            const passwordInputs = await Promise.all(
                frames.map((frame) =>
                    frame
                        .evaluate(
                            (passwordSelector) => document.querySelector(passwordSelector) !== null,
                            DefaultRouterSessionService.PASSWORD_SELECTOR
                        )
                        .catch(() => true)
                )
            );
            const hasPasswordInput = passwordInputs.some(Boolean);
            if (page.url() !== loginUrl || !hasPasswordInput) {
                break;
            }
        }

        if (!signal.aborted) {
            session.initialUrl = page.url();
        }
    }

    private getSession({ sessionId, token }: GetRouterSessionParams): RouterSession {
        const { sid } = this.tokenProvider.verify({ token });
        const session = this.sessions.get(sid);
        if (!session || sid !== sessionId) {
            throw new ApiError({
                message: "La sesión de panel de router no es válida",
                status: 401,
                apiError: routerSessionInvalid
            });
        }
        return session;
    }

    private watchPageLoading({ page, session }: WatchRouterPageLoadingParams): void {
        const isTrackedRequest = (request: HTTPRequest): boolean =>
            DefaultRouterSessionService.LOADING_RESOURCE_TYPES.includes(
                request.resourceType() as (typeof DefaultRouterSessionService.LOADING_RESOURCE_TYPES)[number]
            );
        const settleRequest = (request: HTTPRequest): void => {
            if (!session.loadingRequests.delete(request) || session.loadingRequests.size > 0) {
                return;
            }

            clearTimeout(session.loadingTimeout);
            session.loadingTimeout = setTimeout(
                () => this.setLoading({ session, loading: false }),
                DefaultRouterSessionService.LOADING_CLEAR_DELAY
            );
        };
        page.on("request", (request) => {
            if (!isTrackedRequest(request) || Date.now() > session.loadingUntil) {
                return;
            }

            clearTimeout(session.loadingTimeout);
            session.loadingRequests.add(request);
            this.setLoading({ session, loading: true });
        });
        page.on("requestfinished", settleRequest);
        page.on("requestfailed", settleRequest);
    }

    private setLoading({ session, loading }: SetRouterSessionLoadingParams): void {
        if (session.loading === loading) {
            return;
        }

        session.loading = loading;
        session.statusListeners.forEach((listener) => listener({ loading }));
    }

    private markLoadingInteraction({ session }: MarkRouterSessionLoadingParams): void {
        session.loadingUntil = Date.now() + DefaultRouterSessionService.LOADING_INTERACTION_TIMEOUT;
    }

    private static async startProcess({
        command,
        args
    }: StartProcessParams): Promise<import("node:child_process").ChildProcess> {
        const childProcess = spawn(command, args, { stdio: "ignore" });
        await Promise.race([
            once(childProcess, "spawn"),
            once(childProcess, "error").then(([error]) => Promise.reject(error))
        ]);
        return childProcess;
    }

    private static async connectVnc({ port, attempts, delayMs }: ConnectVncParams): Promise<RouterSessionSocket> {
        let error: unknown;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            let socket;
            try {
                socket = createConnection({ host: "127.0.0.1", port });
                await once(socket, "connect");
                return socket;
            } catch (err) {
                socket?.destroy();
                error = err;
                await delay(delayMs);
            }
        }

        throw error;
    }

    private async cleanupSession({ session }: CleanupRouterSessionParams): Promise<void> {
        clearTimeout(session.timeout);
        clearTimeout(session.loadingTimeout);
        session.autoLoginAbort?.abort();
        await session.browser?.close().catch(() => {});
        session.vnc?.kill("SIGKILL");
        session.xvfb?.kill("SIGKILL");
        if (session.profileDir) {
            await rm(session.profileDir, { recursive: true, force: true });
        }
    }

    private static getViewerUrl({ id, token, routerName, language, clientType, theme }: GetViewerUrlParams): string {
        const query = new URLSearchParams({
            autoconnect: "true",
            path: `/vnc/${id}/socket?token=${token}`,
            status: `/vnc/${id}/status?token=${token}`,
            resize: "remote",
            title: routerName,
            client: clientType,
            theme: theme ?? "dark"
        });
        if (language) {
            query.set("language", language);
        }

        return new URL(`/viewer/?${query}`, publicUrl).href;
    }
}
