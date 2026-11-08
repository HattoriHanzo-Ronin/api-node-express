import type { AuthUserParams } from "../types/auth/auth-facade.js";
import type {
    SocketSessionConnectionParams,
    SocketSessionId,
    SocketSessionNotification,
    SocketSessionOwnedParams,
    SocketSessionResponse
} from "../types/socket-sessions/socket-sessions-service.js";
import type { SocketSessionFacadeSubscribeParams } from "../types/socket-sessions/socket-sessions-facade.js";

export default interface SocketSessionsFacade<Socket> {
    /**
     * Creates a socket session
     *
     * @param params.authUser Authenticated user
     * @returns Socket session
     */
    create(params: AuthUserParams): SocketSessionResponse;
    /**
     * Refreshes a socket session
     *
     * @param params.authUser Authenticated user
     * @param params.id Session identifier
     * @returns Socket session
     */
    refresh(params: SocketSessionOwnedParams): SocketSessionResponse;
    /**
     * Subscribes a socket session to authorized entity changes
     *
     * @param params.authUser Authenticated user
     * @param params.entities Requested entities
     * @param params.id Session identifier
     * @param params.webSocket Socket connection
     */
    subscribe(params: SocketSessionFacadeSubscribeParams<Socket>): Promise<void>;
    /**
     * Notifies subscribed sockets about an entity change
     *
     * @param params.entity Changed entity
     * @param params.data Event data
     * @param params.ownerId Owner identifier
     */
    notify(params: SocketSessionNotification): void;
    /**
     * Disconnects a socket from its session
     *
     * @param params.id Session identifier
     * @param params.webSocket Socket connection
     */
    disconnect(params: SocketSessionConnectionParams<Socket>): void;
    /**
     * Invalidates a socket session
     *
     * @param params.id Session identifier
     */
    invalidate(params: SocketSessionId): void;
    /**
     * Closes a socket session
     *
     * @param params.authUser Authenticated user
     * @param params.id Session identifier
     */
    close(params: SocketSessionOwnedParams): void;
    /**
     * Closes every socket session
     */
    closeAll(): void;
}
