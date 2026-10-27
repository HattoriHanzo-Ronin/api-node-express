import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer-core";
import { ENV } from "../config/environment.js";
import { API_ERROR } from "../config/errors.js";
import JWTUtils from "../utils/jwt-utils.js";
import ApiError from "../utils/error/api-error.js";

/**
 * Manages isolated visible browser sessions for router control panels
 *
 * @author HattoriHanzo-Ronin
 */
export default class RouterSessionService {
    static #PASSWORD_SELECTOR = 'input[type="password"], input[name="password"], input[name="Password"]';
    static #SUBMIT_SELECTOR = "button[type=\"submit\"], input[type=\"submit\"], button:not([type]), .login_button, button.login-btn, button[data-cy=\"loginBtn\"], input#loginSub, input.subBtn";
    static #AUTO_LOGIN_INTERVAL = 250;
    static #AUTO_LOGIN_TIMEOUT = 10_000;
    static #LOADING_CLEAR_DELAY = 200;
    static #LOADING_INTERACTION_TIMEOUT = 1_500;
    static #LOADING_RESOURCE_TYPES = Object.freeze(["document", "fetch", "xhr"]);
    static #VNC_CONNECTION_ATTEMPTS = 50;
    static #VNC_CONNECTION_DELAY = 100;
    static #VIEWPORTS = Object.freeze({ desktop: Object.freeze({ width: 1440, height: 900 }), mobile: Object.freeze({ width: 900, height: 1600 }) });

    #sessions = new Map();
    #ownerSessions = new Map();
    #ownerLocks = new Map();
    #pendingOwners = new Set();
    #nextDisplay = DISPLAY_BASE;

    /**
     * Creates a temporary router control panel session
     *
     * @param {string} params.ownerId Authenticated user identifier
     * @param {string} params.routerName Router display name
     * @param {string} params.routerIp Router control panel IP address
     * @param {string} params.routerPassword Router control panel password
     * @param {string} [params.language] Viewer language
     * @param {"desktop" | "mobile"} params.clientType Viewer client type
     * @param {"dark" | "light"} params.theme Viewer theme
     * @returns {Promise<{ id: string, url: string, expiresAt: string }>} Browser session
     */
    async create({ ownerId, routerName, routerIp, routerPassword, language, clientType, theme }) {
        return this.#createForOwner({ ownerId, routerName, routerIp, routerPassword, language, clientType, theme });
    }

    /**
     * Deletes a router control panel session
     *
     * @param {string} params.sessionId Browser session identifier
     * @param {string} [params.ownerId] Authenticated user identifier
     */
    async close({ sessionId, ownerId }) {
        const session = this.#sessions.get(sessionId);
        if (!session) {
            return;
        }

        ApiError.handle([{
            condition: ownerId !== undefined && session.ownerId !== ownerId,
            message: "La sesión de panel de router no existe",
            status: 404,
            apiError: ROUTER_SESSION_NOT_FOUND
        }]);

        this.#sessions.delete(sessionId);
        const ownerSessions = this.#ownerSessions.get(session.ownerId);
        ownerSessions?.delete(sessionId);
        if (ownerSessions?.size === 0) {
            this.#ownerSessions.delete(session.ownerId);
        }

        try {
            await cleanupSession(session);
        } catch {
            throw new ApiError({
                message: "No se ha podido cerrar la sesión del panel de router",
                apiError: ROUTER_SESSION_FAILED
            });
        }
    }

    /**
     * Navigates an active router control panel browser
     *
     * @param {string} params.sessionId Browser session identifier
     * @param {string} params.ownerId Authenticated user identifier
     * @param {"back" | "reload"} params.action Browser navigation action
     */
    async navigate({ sessionId, ownerId, action }) {
        const session = this.#sessions.get(sessionId);
        ApiError.handle([{
            condition: !session || session.ownerId !== ownerId,
            message: "La sesión de panel de router no existe",
            status: 404,
            apiError: ROUTER_SESSION_NOT_FOUND
        }]);

        try {
            switch (action) {
                case "back":
                    if (!session.initialUrl || session.page.url() === session.initialUrl) {
                        return;
                    }

                    await session.page.goBack({ waitUntil: "domcontentloaded", timeout: 30_000 });
                    return;
                case "reload":
                    this.#markInteraction({ session });
                    await session.page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
            }
        } catch {
            throw new ApiError({
                message: "No se ha podido navegar en el panel de router",
                apiError: ROUTER_SESSION_FAILED
            });
        }
    }

    /**
     * Renews a router control panel session inactivity timeout
     *
     * @param {string} params.sessionId Browser session identifier
     */
    refresh({ sessionId }) {
        const session = this.#sessions.get(sessionId);
        if (!session) {
            return;
        }

        this.#scheduleClose({ session });
    }

    /**
     * Opens a VNC connection for a valid viewer token
     *
     * @param {string} params.sessionId Browser session identifier
     * @param {string} params.token Viewer token
     * @returns {Promise<import("node:net").Socket>} VNC socket
     */
    async openVncSocket({ sessionId, token }) {
        const session = this.#getSession({ sessionId, token });
        ApiError.handle([{
            condition: session.vncConnectionCount >= MAX_VNC_CONNECTIONS_PER_SESSION,
            message: "La sesión de panel de router ya tiene el máximo de conexiones VNC",
            status: 429,
            apiError: ROUTER_SESSION_CONNECTION_CAPACITY_REACHED
        }]);

        session.vncConnectionCount += 1;
        this.#scheduleClose({ session });
        try {
            const vncSocket = await connectVnc({
                port: session.vncPort,
                attempts: RouterSessionService.#VNC_CONNECTION_ATTEMPTS,
                delayMs: RouterSessionService.#VNC_CONNECTION_DELAY
            });
            vncSocket.once("close", () => { session.vncConnectionCount -= 1; });
            return vncSocket;
        } catch {
            session.vncConnectionCount -= 1;
            throw new ApiError({
                message: "No se ha podido abrir la conexión VNC",
                apiError: ROUTER_SESSION_FAILED
            });
        }
    }

    /**
     * Subscribes to a router control panel loading state
     *
     * @param {string} params.sessionId Browser session identifier
     * @param {string} params.token Viewer token
     * @param {(data: { loading: boolean }) => void} params.listener Loading state listener
     * @returns {() => void} Unsubscribe function
     */
    subscribe({ sessionId, token, listener }) {
        const session = this.#getSession({ sessionId, token });
        session.statusListeners.add(listener);
        listener({ loading: session.loading });
        return () => session.statusListeners.delete(listener);
    }

    /**
     * Marks a viewer interaction that may start router loading
     *
     * @param {string} params.sessionId Browser session identifier
     * @param {string} params.token Viewer token
     */
    markInteraction({ sessionId, token }) {
        const session = this.#getSession({ sessionId, token });
        this.#markInteraction({ session });
    }

    /**
     * Deletes every active browser session
     */
    async closeAll() {
        await Promise.allSettled([...this.#sessions.keys()].map((sessionId) => this.close({ sessionId })));
    }

    /**
     * Serializes and limits an owner's router control panel sessions
     *
     * @param {string} params.ownerId Authenticated user identifier
     * @param {string} params.routerName Router display name
     * @param {string} params.routerIp Router control panel IP address
     * @param {string} params.routerPassword Router control panel password
     * @param {string | undefined} params.language Viewer language
     * @param {"desktop" | "mobile"} params.clientType Viewer client type
     * @param {"dark" | "light"} params.theme Viewer theme
     * @returns {Promise<{ id: string, url: string, expiresAt: string }>} Browser session
     */
    async #createForOwner({ ownerId, routerName, routerIp, routerPassword, language, clientType, theme }) {
        const previous = this.#ownerLocks.get(ownerId) ?? Promise.resolve();
        let release;
        const lock = new Promise((resolve) => { release = resolve; });
        this.#ownerLocks.set(ownerId, lock);
        await previous;
        try {
            const ownerSessions = this.#ownerSessions.get(ownerId) ?? new Set();
            const activeOwners = new Set([...this.#ownerSessions.keys(), ...this.#pendingOwners]);
            ApiError.handle([{
                condition: ownerSessions.size === 0 && activeOwners.size >= MAX_ACTIVE_USERS,
                message: "Se ha alcanzado el número máximo de sesiones activas",
                status: 429,
                apiError: ROUTER_SESSION_CAPACITY_REACHED
            }]);
            this.#pendingOwners.add(ownerId);
            if (ownerSessions.size >= MAX_SESSIONS_PER_USER) {
                await Promise.all([...ownerSessions].map((sessionId) => this.close({ sessionId })));
            }

            return await this.#createSession({ ownerId, routerName, routerIp, routerPassword, language, clientType, theme });
        } finally {
            this.#pendingOwners.delete(ownerId);
            release();
            if (this.#ownerLocks.get(ownerId) === lock) {
                this.#ownerLocks.delete(ownerId);
            }
        }
    }

    /**
     * Starts the resources for an isolated router control panel session
     *
     * @param {string} params.ownerId Authenticated user identifier
     * @param {string} params.routerName Router display name
     * @param {string} params.routerIp Router control panel IP address
     * @param {string} params.routerPassword Router control panel password
     * @param {string | undefined} params.language Viewer language
     * @param {"desktop" | "mobile"} params.clientType Viewer client type
     * @param {"dark" | "light"} params.theme Viewer theme
     * @returns {Promise<{ id: string, url: string, expiresAt: string }>} Browser session
     */
    async #createSession({ ownerId, routerName, routerIp, routerPassword, language, clientType, theme }) {
        const id = randomUUID();
        const token = JWTUtils.generateAccessToken({ sid: id });
        const display = this.#nextDisplay;
        this.#nextDisplay += 1;
        const vncPort = VNC_PORT_BASE + display - DISPLAY_BASE;
        const { width, height } = RouterSessionService.#VIEWPORTS[clientType] ?? RouterSessionService.#VIEWPORTS.desktop;
        const session = {
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
            session.xvfb = await startProcess({
                command: "Xvfb",
                args: [`:${display}`, "-screen", "0", `${width}x${height}x24`, "-nolisten", "tcp"]
            });
            session.browser = await puppeteer.launch({
                executablePath: CHROME_PATH,
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
            const page = initialPage ?? await session.browser.newPage();
            session.page = page;
            this.#watchPageLoading({ page, session });
            await page.setViewport({ width, height });
            await page.goto(`http://${routerIp}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
            if (routerPassword === undefined) {
                session.initialUrl = page.url();
            }

            session.vnc = await startProcess({
                command: "x11vnc",
                args: ["-display", `:${display}`, "-localhost", "-forever", "-shared", "-rfbport", String(vncPort)]
            });
            this.#sessions.set(id, session);
            const ownerSessions = this.#ownerSessions.get(ownerId) ?? new Set();
            ownerSessions.add(id);
            this.#ownerSessions.set(ownerId, ownerSessions);
            this.#scheduleClose({ session });
            if (routerPassword !== undefined) {
                session.autoLoginAbort = new AbortController();
                void this.#autofillPassword({ page, password: routerPassword, routerIp, session, signal: session.autoLoginAbort.signal }).catch(() => {});
            }

            return {
                id,
                url: getViewerUrl({ id, token, routerName, language, clientType, theme }),
                expiresAt: new Date(Date.now() + SESSION_INACTIVITY_TIMEOUT).toISOString()
            };
        } catch {
            await cleanupSession(session).catch(() => {});
            throw new ApiError({
                message: "No se ha podido crear la sesión del panel de router",
                apiError: ROUTER_SESSION_FAILED
            });
        }
    }

    #scheduleClose({ session }) {
        clearTimeout(session.timeout);
        const timeout = setTimeout(() => void this.close({ sessionId: session.id }).catch(() => {}), SESSION_INACTIVITY_TIMEOUT);
        timeout.unref();
        session.timeout = timeout;
    }

    /**
     * Fills the router login form when it becomes available in a browser frame
     *
     * @param {import("puppeteer-core").Page} params.page Router control panel page
     * @param {string} params.password Router control panel password
     * @param {string} params.routerIp Router control panel IP address
     * @param {Object} params.session Browser session
     * @param {AbortSignal} params.signal Session cleanup signal
     */
    async #autofillPassword({ page, password, routerIp, session, signal }) {
        while (!signal.aborted) {
            if (new URL(page.url()).hostname === routerIp) {
                const results = await Promise.all(page.frames().map((frame) => this.#fillPassword({ frame, password }).catch(() => false)));
                const filled = results.some(Boolean);
                if (filled) {
                    await this.#captureInitialUrl({ page, session, signal });
                    return;
                }
            }

            await delay(RouterSessionService.#AUTO_LOGIN_INTERVAL, undefined, { signal }).catch(() => {});
        }
    }

    async #fillPassword({ frame, password }) {
        return frame.evaluate(({ password, passwordSelector, submitSelector }) => {
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
                submitButton?.click();
            }, 100);
            return true;
        }, {
            password,
            passwordSelector: RouterSessionService.#PASSWORD_SELECTOR,
            submitSelector: RouterSessionService.#SUBMIT_SELECTOR
        });
    }

    async #captureInitialUrl({ page, session, signal }) {
        const loginUrl = page.url();
        const timeout = Date.now() + RouterSessionService.#AUTO_LOGIN_TIMEOUT;
        while (!signal.aborted && Date.now() < timeout) {
            await delay(RouterSessionService.#AUTO_LOGIN_INTERVAL, undefined, { signal }).catch(() => {});
            const frames = page.frames();
            const passwordInputs = await Promise.all(
                frames.map((frame) =>
                    frame.evaluate((passwordSelector) => document.querySelector(passwordSelector) !== null, RouterSessionService.#PASSWORD_SELECTOR).catch(() => true)
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

    #getSession({ sessionId, token }) {
        const { sid } = JWTUtils.verifyAccessToken(token);
        const session = this.#sessions.get(sid);
        ApiError.handle([{
            condition: !session || sid !== sessionId,
            message: "La sesión de panel de router no es válida",
            status: 401,
            apiError: ROUTER_SESSION_INVALID
        }]);
        return session;
    }

    #watchPageLoading({ page, session }) {
        const isTrackedRequest = (request) => RouterSessionService.#LOADING_RESOURCE_TYPES.includes(request.resourceType());
        const settleRequest = (request) => {
            if (!session.loadingRequests.delete(request) || session.loadingRequests.size > 0) {
                return;
            }

            clearTimeout(session.loadingTimeout);
            session.loadingTimeout = setTimeout(
                () => this.#setLoading({ session, loading: false }),
                RouterSessionService.#LOADING_CLEAR_DELAY
            );
        };
        page.on("request", (request) => {
            if (!isTrackedRequest(request) || Date.now() > session.loadingUntil) {
                return;
            }

            clearTimeout(session.loadingTimeout);
            session.loadingRequests.add(request);
            this.#setLoading({ session, loading: true });
        });
        page.on("requestfinished", settleRequest);
        page.on("requestfailed", settleRequest);
    }

    #setLoading({ session, loading }) {
        if (session.loading === loading) {
            return;
        }

        session.loading = loading;
        session.statusListeners.forEach((listener) => listener({ loading }));
    }

    #markInteraction({ session }) {
        session.loadingUntil = Date.now() + RouterSessionService.#LOADING_INTERACTION_TIMEOUT;
    }
}

async function startProcess({ command, args }) {
    const childProcess = spawn(command, args, { stdio: "ignore" });
    await Promise.race([
        once(childProcess, "spawn"),
        once(childProcess, "error").then(([error]) => Promise.reject(error))
    ]);
    return childProcess;
}

async function connectVnc({ port, attempts, delayMs }) {
    let error;
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

async function cleanupSession(session) {
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

function getViewerUrl({ id, token, routerName, language, clientType, theme }) {
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

    return new URL(`/viewer/?${query}`, PUBLIC_URL).href;
}

const {
    chromePath: CHROME_PATH,
    displayBase: DISPLAY_BASE,
    maxActiveUsers: MAX_ACTIVE_USERS,
    maxSessionsPerUser: MAX_SESSIONS_PER_USER,
    maxVncConnectionsPerSession: MAX_VNC_CONNECTIONS_PER_SESSION,
    publicUrl: PUBLIC_URL,
    sessionInactivityTimeout: SESSION_INACTIVITY_TIMEOUT,
    vncPortBase: VNC_PORT_BASE
} = ENV;
const {
    routerSessionCapacityReached: ROUTER_SESSION_CAPACITY_REACHED,
    routerSessionConnectionCapacityReached: ROUTER_SESSION_CONNECTION_CAPACITY_REACHED,
    routerSessionFailed: ROUTER_SESSION_FAILED,
    routerSessionInvalid: ROUTER_SESSION_INVALID,
    routerSessionNotFound: ROUTER_SESSION_NOT_FOUND
} = API_ERROR;
