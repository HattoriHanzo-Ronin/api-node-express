import type { AuthUserParams } from "../../types/auth/auth-facade.js";
import type SocketSessionsService from "../socket-sessions-service.js";
import type {
    SocketSessionConnectionParams,
    SocketSessionConnectParams,
    SocketSessionId,
    SocketSessionNotification,
    SocketSessionOwnedParams,
    SocketSessionResponse,
    SocketSessionSubscribeParams
} from "../../types/socket-sessions/socket-sessions-service.js";
import type {
    SocketSession,
    ConnectedSocketSession,
    SocketSessionParams,
    SocketSessionMaybeParams,
    SocketSessionDisconnectParams,
    SocketSessionTouchParams,
    SocketSessionOwnerParams,
    SocketSessionRequiredOwnerParams,
    SocketSessionRelease
} from "../../types/socket-sessions/default-socket-sessions-service.js";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { ENV } from "../../config/environment.js";
import { API_ERROR } from "../../config/errors.js";
import ApiError from "../../utils/error/api-error.js";

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
export default class DefaultSocketSessionsService implements SocketSessionsService<WebSocket> {
    private readonly sessions = new Map<string, SocketSession>();
    private readonly ownerSessions = new Map<string, Set<string>>();
    private readonly connectingSessions = new Set<string>();
    private readonly pendingConnectionsByOwner = new Map<string, number>();
    private readonly protectedUserIds: Map<string, number>;

    constructor() {
        this.protectedUserIds = new Map(
            Object.entries(protectedUsers).flatMap(([ownerId, { socket }]) =>
                socket === undefined ? [] : [[ownerId, socket]]
            )
        );
        ApiError.handle([
            {
                condition:
                    [...this.protectedUserIds.values()].reduce((total, value) => total + value, 0) >
                    socketMaxConnections,
                message: "Las reservas de sockets superan el límite global de conexiones",
                apiError: socketConfigurationInvalid
            }
        ]);
    }

    create({ authUser }: AuthUserParams) {
        const { id: ownerId, exp } = authUser;
        const ownerSessions = this.ownerSessions.get(ownerId) ?? new Set();

        const id = randomUUID();
        const session: SocketSession = {
            id,
            ownerId,
            webSocket: null,
            entities: new Set(),
            timeout: null,
            expiresAt: 0,
            exp
        };
        this.sessions.set(id, session);
        ownerSessions.add(id);
        this.ownerSessions.set(ownerId, ownerSessions);
        this.touch({ session, exp });
        return this.toResponse({ session });
    }

    refresh({ authUser, id }: SocketSessionOwnedParams) {
        const session = this.getOwned({ authUser, id });
        this.touch({ session, exp: authUser.exp });
        return this.toResponse({ session });
    }

    async connect({ authUser, id, webSocket }: SocketSessionConnectParams<WebSocket>) {
        const session = this.getOwned({ authUser, id });
        ApiError.handle([
            {
                condition: this.connectingSessions.has(id),
                message: "La sesión de notificaciones ya tiene una conexión activa",
                status: 409,
                apiError: socketSessionInvalid
            }
        ]);
        this.connectingSessions.add(id);
        try {
            const currentSocket = session.webSocket;
            if (currentSocket !== null && currentSocket !== webSocket) {
                const active = await this.isSocketActive(currentSocket);
                if (active && session.webSocket === currentSocket) {
                    throw new ApiError({
                        message: "La sesión de notificaciones ya tiene una conexión activa",
                        status: 409,
                        apiError: socketSessionInvalid
                    });
                }

                this.disconnectSession({ session, webSocket: currentSocket });
            }

            const releaseConnection = await this.reserveConnection({ ownerId: authUser.id });
            try {
                session.webSocket = webSocket;
                this.touch({ session, exp: authUser.exp });
            } finally {
                releaseConnection();
            }
        } finally {
            this.connectingSessions.delete(id);
        }
    }

    subscribe({ id, webSocket, entities }: SocketSessionSubscribeParams<WebSocket>) {
        const session = this.sessions.get(id);
        ApiError.handle([
            {
                condition: session?.webSocket !== webSocket,
                message: "La conexión de notificaciones no es válida",
                status: 401,
                apiError: socketSessionInvalid
            }
        ]);

        session!.entities = new Set(entities);
    }

    notify({ entity, data, ownerId }: SocketSessionNotification) {
        for (const session of this.sessions.values()) {
            if ((ownerId !== undefined && session.ownerId !== ownerId) || !session.entities.has(entity)) {
                continue;
            }

            if (session.webSocket?.readyState !== WebSocket.OPEN) {
                continue;
            }

            try {
                session.webSocket.send(JSON.stringify({ entity, ...data }));
                this.touch({ session, exp: session.exp });
            } catch {
                this.delete({ session });
            }
        }
    }

    disconnect({ id, webSocket }: SocketSessionConnectionParams<WebSocket>) {
        const session = this.sessions.get(id);
        this.disconnectSession({ session, webSocket });
    }

    close({ authUser, id }: SocketSessionOwnedParams) {
        const session = this.getOwned({ authUser, id });
        this.delete({ session });
    }

    invalidate({ id }: SocketSessionId) {
        this.delete({ session: this.sessions.get(id) });
    }

    closeAll() {
        for (const session of [...this.sessions.values()]) {
            this.delete({ session });
        }
    }

    private getOwned({ authUser, id }: SocketSessionOwnedParams): SocketSession {
        const session = this.sessions.get(id);
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
        return session!;
    }

    private async reserveConnection({ ownerId }: SocketSessionRequiredOwnerParams): Promise<SocketSessionRelease> {
        this.addPendingConnection(ownerId);
        try {
            if (
                this.activeConnectionsByOwner(ownerId) + this.pendingConnectionsByOwner.get(ownerId)! >
                socketMaxConnectionsPerUser
            ) {
                await this.releaseInactiveConnections({ ownerId });
            }
            ApiError.handle([
                {
                    condition:
                        this.activeConnectionsByOwner(ownerId) + this.pendingConnectionsByOwner.get(ownerId)! >
                        socketMaxConnectionsPerUser,
                    message: `Has alcanzado el límite de ${socketMaxConnectionsPerUser} conexiones simultáneas. Cierra una conexión en otro dispositivo para continuar.`,
                    status: 429,
                    apiError: socketConnectionLimitReached
                }
            ]);
            if (!this.hasGlobalCapacity()) {
                await this.releaseInactiveConnections({});
            }
            ApiError.handle([
                {
                    condition: !this.hasGlobalCapacity(),
                    message: "Se alcanzó el máximo global de conexiones de notificaciones",
                    status: 429,
                    apiError: socketConnectionCapacityReached
                }
            ]);
            return () => this.removePendingConnection(ownerId);
        } catch (err) {
            this.removePendingConnection(ownerId);
            throw err;
        }
    }

    private async releaseInactiveConnections({ ownerId }: SocketSessionOwnerParams): Promise<void> {
        const sessions = [...this.sessions.values()].filter(
            (session): session is ConnectedSocketSession =>
                session.webSocket !== null && (ownerId === undefined || session.ownerId === ownerId)
        );
        const active = await Promise.all(
            sessions.map(async (session) => {
                const webSocket = session.webSocket;
                return { session, webSocket, active: await this.isSocketActive(webSocket) };
            })
        );
        active
            .filter(({ active }) => !active)
            .forEach(({ session, webSocket }) =>
                this.disconnectSession({
                    session,
                    webSocket,
                    terminate: true
                })
            );
    }

    private hasGlobalCapacity(): boolean {
        const connectionsByOwner = new Map<string, number>();
        for (const session of this.sessions.values()) {
            if (session.webSocket !== null) {
                connectionsByOwner.set(session.ownerId, (connectionsByOwner.get(session.ownerId) ?? 0) + 1);
            }
        }
        for (const [id, pending] of this.pendingConnectionsByOwner) {
            connectionsByOwner.set(id, (connectionsByOwner.get(id) ?? 0) + pending);
        }
        const activeConnections = [...connectionsByOwner.values()].reduce((total, count) => total + count, 0);
        const unclaimedReservations = [...this.protectedUserIds].reduce(
            (total, [id, reserved]) => total + Math.max(0, reserved - (connectionsByOwner.get(id) ?? 0)),
            0
        );
        return activeConnections + unclaimedReservations <= socketMaxConnections;
    }

    private activeConnectionsByOwner(ownerId: string): number {
        return [...this.sessions.values()].filter(
            (session) => session.ownerId === ownerId && session.webSocket !== null
        ).length;
    }

    private addPendingConnection(ownerId: string): void {
        this.pendingConnectionsByOwner.set(ownerId, (this.pendingConnectionsByOwner.get(ownerId) ?? 0) + 1);
    }

    private removePendingConnection(ownerId: string): void {
        const pending = this.pendingConnectionsByOwner.get(ownerId)! - 1;
        if (pending === 0) {
            this.pendingConnectionsByOwner.delete(ownerId);
            return;
        }

        this.pendingConnectionsByOwner.set(ownerId, pending);
    }

    private disconnectSession({ session, webSocket, terminate = false }: SocketSessionDisconnectParams): void {
        if (session?.webSocket === webSocket) {
            session.webSocket = null;
            if (terminate) {
                webSocket.terminate?.();
            }
        }
    }

    private isSocketActive(webSocket: WebSocket): Promise<boolean> {
        if (webSocket.readyState !== WebSocket.OPEN) {
            return Promise.resolve(false);
        }

        return new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => complete(false), socketPingTimeout);
            const complete = (active: boolean) => {
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

    private touch({ session, exp }: SocketSessionTouchParams): void {
        clearTimeout(session.timeout ?? undefined);
        session.exp = exp;
        const expiresAt = Math.min(Date.now() + socketSessionInactivityTimeout, exp * 1000);
        session.expiresAt = expiresAt;
        session.timeout = setTimeout(() => this.delete({ session }), Math.max(0, expiresAt - Date.now()));
    }

    private delete({ session }: SocketSessionMaybeParams): void {
        if (!session) {
            return;
        }

        clearTimeout(session.timeout ?? undefined);
        session.webSocket?.close();
        this.sessions.delete(session.id);
        const ownerSessions = this.ownerSessions.get(session.ownerId);
        ownerSessions?.delete(session.id);
        if (ownerSessions?.size === 0) {
            this.ownerSessions.delete(session.ownerId);
        }
    }

    private toResponse({ session }: SocketSessionParams): SocketSessionResponse {
        return { id: session.id, expiresAt: new Date(session.expiresAt).toISOString() };
    }
}
