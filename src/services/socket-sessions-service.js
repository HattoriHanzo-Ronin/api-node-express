import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { ENV } from "../config/environment.js";
import { API_ERROR } from "../config/errors.js";
import ApiError from "../utils/error/api-error.js";

const {
    socketMaxConnections,
    socketMaxConnectionsPerUser,
    socketSessionInactivityTimeout,
    socketPingTimeout,
    protectedUsers
} = ENV;
const {
    socketSessionNotFound,
    socketConnectionCapacityReached,
    socketConnectionLimitReached,
    socketConfigurationInvalid,
    socketSessionInvalid
} = API_ERROR;

/**
 * Manages authenticated WebSocket sessions
 *
 * @author HattoriHanzo-Ronin
 */
export default class SocketSessionsService {
    #sessions = new Map();
    #ownerSessions = new Map();
    #connectingSessions = new Set();
    #pendingConnectionsByOwner = new Map();
    #protectedUserIds;

    constructor() {
        this.#protectedUserIds = new Map(Object.entries(protectedUsers)
            .flatMap(([ownerId, { socket }]) => socket === undefined ? [] : [[ownerId, socket]]));
        ApiError.handle([{
            condition: [...this.#protectedUserIds.values()].reduce((total, value) => total + value, 0) > socketMaxConnections,
            message: "Las reservas de sockets superan el límite global de conexiones",
            apiError: socketConfigurationInvalid
        }]);
    }

    /**
     * Creates a WebSocket session for an authenticated user
     *
     * @param {Object} params.authUser Authenticated user
     * @returns {{ id: string, expiresAt: string }} Socket session
     */
    create({ authUser }) {
        const { id: ownerId, exp } = authUser;
        const ownerSessions = this.#ownerSessions.get(ownerId) ?? new Set();

        const id = randomUUID();
        const session = { id, ownerId, webSocket: null, entities: new Set(), timeout: null, expiresAt: 0, exp };
        this.#sessions.set(id, session);
        ownerSessions.add(id);
        this.#ownerSessions.set(ownerId, ownerSessions);
        this.#touch({ session, exp });
        return this.#toResponse({ session });
    }

    /**
     * Refreshes an owned WebSocket session
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.id Socket session identifier
     * @returns {{ id: string, expiresAt: string }} Socket session
     */
    refresh({ authUser, id }) {
        const session = this.#getOwned({ authUser, id });
        this.#touch({ session, exp: authUser.exp });
        return this.#toResponse({ session });
    }

    /**
     * Associates an authenticated socket with its session
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.id Socket session identifier
     * @param {import("ws").WebSocket} params.webSocket WebSocket connection
     */
    async connect({ authUser, id, webSocket }) {
        const session = this.#getOwned({ authUser, id });
        ApiError.handle([{
            condition: this.#connectingSessions.has(id),
            message: "La sesión de notificaciones ya tiene una conexión activa",
            status: 409,
            apiError: socketSessionInvalid
        }]);
        this.#connectingSessions.add(id);
        try {
            if (session.webSocket !== null && session.webSocket !== webSocket) {
                const active = await this.#isSocketActive(session.webSocket);
                if (active) {
                    throw new ApiError({ message: "La sesión de notificaciones ya tiene una conexión activa", status: 409, apiError: socketSessionInvalid });
                }

                this.#disconnect({ session, webSocket: session.webSocket });
            }

            const releaseConnection = await this.#reserveConnection({ ownerId: authUser.id });
            try {
                session.webSocket = webSocket;
                this.#touch({ session, exp: authUser.exp });
            } finally {
                releaseConnection();
            }
        } finally {
            this.#connectingSessions.delete(id);
        }
    }

    /**
     * Subscribes a connected socket to entity changes
     *
     * @param {string} params.id Socket session identifier
     * @param {import("ws").WebSocket} params.webSocket WebSocket connection
     * @param {string[]} params.entities Entity identifiers
     */
    subscribe({ id, webSocket, entities }) {
        const session = this.#sessions.get(id);
        ApiError.handle([{
            condition: session?.webSocket !== webSocket,
            message: "La conexión de notificaciones no es válida",
            status: 401,
            apiError: socketSessionInvalid
        }]);

        session.entities = new Set(entities);
    }

    /**
     * Sends an entity change notification to subscribed sockets
     *
     * @param {string} params.entity Changed entity identifier
     * @param {Object | undefined} [params.data] Additional event data
     * @param {string | undefined} [params.ownerId] Owner identifier for private resources
     */
    notify({ entity, data, ownerId }) {
        for (const session of this.#sessions.values()) {
            if ((ownerId !== undefined && session.ownerId !== ownerId) || !session.entities.has(entity)) {
                continue;
            }

            if (session.webSocket?.readyState !== WebSocket.OPEN) {
                continue;
            }

            try {
                session.webSocket.send(JSON.stringify({ entity, ...data }));
                this.#touch({ session, exp: session.exp });
            } catch {
                this.#delete({ session });
            }
        }
    }

    /**
     * Detaches a closed socket from its session
     *
     * @param {string} params.id Socket session identifier
     * @param {import("ws").WebSocket} params.webSocket WebSocket connection
     */
    disconnect({ id, webSocket }) {
        const session = this.#sessions.get(id);
        this.#disconnect({ session, webSocket });
    }

    /**
     * Deletes an owned WebSocket session
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.id Socket session identifier
     */
    close({ authUser, id }) {
        const session = this.#getOwned({ authUser, id });
        this.#delete({ session });
    }

    /**
     * Deletes a WebSocket session after authentication fails
     *
     * @param {string} params.id Socket session identifier
     */
    invalidate({ id }) {
        this.#delete({ session: this.#sessions.get(id) });
    }

    /**
     * Closes every managed WebSocket session
     */
    closeAll() {
        for (const session of [...this.#sessions.values()]) {
            this.#delete({ session });
        }
    }

    #getOwned({ authUser, id }) {
        const session = this.#sessions.get(id);
        ApiError.handle([
            {
                condition: !session,
                message: "La sesión de notificaciones no existe",
                status: 404,
                apiError: socketSessionNotFound
            },
            {
                condition: session?.ownerId !== authUser.id,
                message: "La sesión de notificaciones no es válida",
                status: 401,
                apiError: socketSessionInvalid
            }
        ]);
        return session;
    }

    async #reserveConnection({ ownerId }) {
        this.#addPendingConnection(ownerId);
        try {
            if (this.#activeConnectionsByOwner(ownerId) + this.#pendingConnectionsByOwner.get(ownerId) > socketMaxConnectionsPerUser) {
                await this.#releaseInactiveConnections({ ownerId });
            }
            ApiError.handle([{
                condition: this.#activeConnectionsByOwner(ownerId) + this.#pendingConnectionsByOwner.get(ownerId) > socketMaxConnectionsPerUser,
                message: `Has alcanzado el límite de ${socketMaxConnectionsPerUser} conexiones simultáneas. Cierra una conexión en otro dispositivo para continuar.`,
                status: 429,
                apiError: socketConnectionLimitReached
            }]);
            if (!this.#hasGlobalCapacity()) {
                await this.#releaseInactiveConnections({});
            }
            ApiError.handle([{
                condition: !this.#hasGlobalCapacity(),
                message: "Se alcanzó el máximo global de conexiones de notificaciones",
                status: 429,
                apiError: socketConnectionCapacityReached
            }]);
            return () => this.#removePendingConnection(ownerId);
        } catch (err) {
            this.#removePendingConnection(ownerId);
            throw err;
        }
    }

    async #releaseInactiveConnections({ ownerId }) {
        const sessions = [...this.#sessions.values()].filter((session) => session.webSocket !== null && (ownerId === undefined || session.ownerId === ownerId));
        const active = await Promise.all(sessions.map(async (session) => ({ session, active: await this.#isSocketActive(session.webSocket) })));
        active.filter(({ active }) => !active).forEach(({ session }) => this.#disconnect({
            session,
            webSocket: session.webSocket,
            terminate: true
        }));
    }

    #hasGlobalCapacity() {
        const connectionsByOwner = new Map();
        for (const session of this.#sessions.values()) {
            if (session.webSocket !== null) {
                connectionsByOwner.set(session.ownerId, (connectionsByOwner.get(session.ownerId) ?? 0) + 1);
            }
        }
        for (const [id, pending] of this.#pendingConnectionsByOwner) {
            connectionsByOwner.set(id, (connectionsByOwner.get(id) ?? 0) + pending);
        }
        const activeConnections = [...connectionsByOwner.values()].reduce((total, count) => total + count, 0);
        const unclaimedReservations = [...this.#protectedUserIds].reduce((total, [id, reserved]) =>
            total + Math.max(0, reserved - (connectionsByOwner.get(id) ?? 0)), 0);
        return activeConnections + unclaimedReservations <= socketMaxConnections;
    }

    #activeConnectionsByOwner(ownerId) {
        return [...this.#sessions.values()].filter((session) => session.ownerId === ownerId && session.webSocket !== null).length;
    }

    #addPendingConnection(ownerId) {
        this.#pendingConnectionsByOwner.set(ownerId, (this.#pendingConnectionsByOwner.get(ownerId) ?? 0) + 1);
    }

    #removePendingConnection(ownerId) {
        const pending = this.#pendingConnectionsByOwner.get(ownerId) - 1;
        if (pending === 0) {
            this.#pendingConnectionsByOwner.delete(ownerId);
            return;
        }

        this.#pendingConnectionsByOwner.set(ownerId, pending);
    }

    #disconnect({ session, webSocket, terminate = false }) {
        if (session?.webSocket === webSocket) {
            session.webSocket = null;
            if (terminate) {
                webSocket.terminate?.();
            }
        }
    }

    #isSocketActive(webSocket) {
        if (webSocket.readyState !== WebSocket.OPEN) {
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(() => complete(false), socketPingTimeout);
            const complete = (active) => {
                clearTimeout(timeout);
                webSocket.off("pong", onPong);
                resolve(active);
            };
            const onPong = () => complete(true);
            webSocket.once("pong", onPong);
            try {
                webSocket.ping();
            } catch {
                complete(false);
            }
        });
    }

    #touch({ session, exp }) {
        clearTimeout(session.timeout);
        session.exp = exp;
        const expiresAt = Math.min(Date.now() + socketSessionInactivityTimeout, exp * 1000);
        session.expiresAt = expiresAt;
        session.timeout = setTimeout(() => this.#delete({ session }), Math.max(0, expiresAt - Date.now()));
    }

    #delete({ session }) {
        if (!session) {
            return;
        }

        clearTimeout(session.timeout);
        session.webSocket?.close();
        this.#sessions.delete(session.id);
        const ownerSessions = this.#ownerSessions.get(session.ownerId);
        ownerSessions?.delete(session.id);
        if (ownerSessions?.size === 0) {
            this.#ownerSessions.delete(session.ownerId);
        }
    }

    #toResponse({ session }) {
        return { id: session.id, expiresAt: new Date(session.expiresAt).toISOString() };
    }
}
