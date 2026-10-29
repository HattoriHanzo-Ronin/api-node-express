import { randomUUID } from "node:crypto";
import { ENV } from "../config/environment.js";
import { API_ERROR } from "../config/errors.js";
import ApiError from "../utils/error/api-error.js";

const {
    socketMaxConnections,
    socketMaxConnectionsPerUser,
    socketSessionInactivityTimeout
} = ENV;
const { socketSessionNotFound, socketSessionCapacityReached, socketSessionInvalid } = API_ERROR;

/**
 * Manages authenticated WebSocket sessions
 *
 * @author HattoriHanzo-Ronin
 */
export default class SocketSessionsService {
    #sessions = new Map();
    #ownerSessions = new Map();

    /**
     * Creates a WebSocket session for an authenticated user
     *
     * @param {Object} params.authUser Authenticated user
     * @returns {{ id: string, expiresAt: string }} Socket session
     */
    create({ authUser }) {
        const { id: ownerId, exp } = authUser;
        const ownerSessions = this.#ownerSessions.get(ownerId) ?? new Set();
        ApiError.handle([
            {
                condition: this.#sessions.size >= socketMaxConnections || ownerSessions.size >= socketMaxConnectionsPerUser,
                message: "Se alcanzó el máximo de conexiones de notificaciones",
                status: 429,
                apiError: socketSessionCapacityReached
            }
        ]);

        const id = randomUUID();
        const session = { id, ownerId, webSocket: null, timeout: null, expiresAt: 0 };
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
    connect({ authUser, id, webSocket }) {
        const session = this.#getOwned({ authUser, id });
        ApiError.handle([{
            condition: session.webSocket !== null && session.webSocket !== webSocket,
            message: "La sesión de notificaciones ya tiene una conexión activa",
            status: 409,
            apiError: socketSessionInvalid
        }]);

        session.webSocket = webSocket;
        this.#touch({ session, exp: authUser.exp });
    }

    /**
     * Registers activity from an authenticated socket
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.id Socket session identifier
     * @param {import("ws").WebSocket} params.webSocket WebSocket connection
     */
    activity({ authUser, id, webSocket }) {
        const session = this.#getOwned({ authUser, id });
        ApiError.handle([{
            condition: session.webSocket !== webSocket,
            message: "La conexión de notificaciones no es válida",
            status: 401,
            apiError: socketSessionInvalid
        }]);

        this.#touch({ session, exp: authUser.exp });
    }

    /**
     * Detaches a closed socket from its session
     *
     * @param {string} params.id Socket session identifier
     * @param {import("ws").WebSocket} params.webSocket WebSocket connection
     */
    disconnect({ id, webSocket }) {
        const session = this.#sessions.get(id);
        if (session?.webSocket === webSocket) {
            session.webSocket = null;
        }
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

    #touch({ session, exp }) {
        clearTimeout(session.timeout);
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
