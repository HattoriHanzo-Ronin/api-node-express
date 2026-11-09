import type { AuthUserParams } from "../types/auth/auth-facade.js";
import type {
    SocketSessionConnectionParams,
    SocketSessionConnectParams,
    SocketSessionId,
    SocketSessionNotification,
    SocketSessionOwnedParams,
    SocketSessionResponse,
    SocketSessionSubscribeParams
} from "../types/socket-sessions/socket-sessions-service.js";

export default interface SocketSessionsService<Socket> {
    /**
     * Creates a socket session for an authenticated user
     *
     * @param params.authUser Authenticated user
     * @returns Socket session
     */
    create(params: AuthUserParams): SocketSessionResponse;

    /**
     * Refreshes an owned socket session
     *
     * @param params.authUser Authenticated user
     * @param params.id Session identifier
     * @returns Socket session
     */
    refresh(params: SocketSessionOwnedParams): SocketSessionResponse;

    /**
     * Associates a socket with its session
     *
     * @param params.authUser Authenticated user
     * @param params.id Session identifier
     * @param params.webSocket Socket connection
     */
    connect(params: SocketSessionConnectParams<Socket>): Promise<void>;

    /**
     * Subscribes a socket to entity changes
     *
     * @param params.id Session identifier
     * @param params.webSocket Socket connection
     * @param params.entities Entity identifiers
     */
    subscribe(params: SocketSessionSubscribeParams<Socket>): void;

    /**
     * Sends an entity change notification
     *
     * @param params.entity Changed entity
     * @param params.data Event data
     * @param params.ownerId Owner identifier
     */
    notify(params: SocketSessionNotification): void;

    /**
     * Detaches a socket from its session
     *
     * @param params.id Session identifier
     * @param params.webSocket Socket connection
     */
    disconnect(params: SocketSessionConnectionParams<Socket>): void;

    /**
     * Deletes an owned session
     *
     * @param params.authUser Authenticated user
     * @param params.id Session identifier
     */
    close(params: SocketSessionOwnedParams): void;

    /**
     * Deletes a session after authentication fails
     *
     * @param params.id Session identifier
     */
    invalidate(params: SocketSessionId): void;

    /**
     * Closes every managed session
     */
    closeAll(): void;
}
