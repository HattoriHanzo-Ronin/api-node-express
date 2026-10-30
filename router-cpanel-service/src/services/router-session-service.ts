import type {
    CloseRouterSessionParams,
    CreateRouterSessionParams,
    MarkRouterSessionInteractionParams,
    NavigateRouterSessionParams,
    OpenRouterSessionVncSocketParams,
    RefreshRouterSessionParams,
    RouterSessionResponse,
    SubscribeRouterSessionStatusParams
} from "../types/router-session-service.js";

/**
 * Router control panel session service contract
 *
 * @author HattoriHanzo-Ronin
 */
export interface RouterSessionService<Connection> {

    /**
     * Creates a router control panel session
     *
     * @param params.ownerId Authenticated user identifier
     * @param params.routerName Router display name
     * @param params.routerIp Router control panel IP address
     * @param params.routerPassword Router control panel password
     * @param params.language Viewer language
     * @param params.clientType Viewer client type
     * @param params.theme Viewer theme
     * @returns Created session
     * @throws {ApiError} When the session cannot be created or capacity is exhausted
     */
    create(params: CreateRouterSessionParams): Promise<RouterSessionResponse>;

    /**
     * Closes a router control panel session
     *
     * @param params.sessionId Browser session identifier
     * @param params.ownerId Authenticated user identifier
     * @throws {ApiError} When the session belongs to another user or cannot be closed
     */
    close(params: CloseRouterSessionParams): Promise<void>;

    /**
     * Navigates a router control panel session
     *
     * @param params.sessionId Browser session identifier
     * @param params.ownerId Authenticated user identifier
     * @param params.action Navigation action
     * @throws {ApiError} When the session does not exist or navigation fails
     */
    navigate(params: NavigateRouterSessionParams): Promise<void>;

    /**
     * Renews a router control panel session inactivity timeout
     *
     * @param params.sessionId Browser session identifier
     */
    refresh(params: RefreshRouterSessionParams): void;

    /**
     * Opens a VNC socket for a router control panel session
     *
     * @param params.sessionId Browser session identifier
     * @param params.token Viewer token
     * @returns Connected VNC socket
     * @throws {ApiError} When the session or token is invalid, or VNC capacity is exhausted
     */
    openVncSocket(params: OpenRouterSessionVncSocketParams): Promise<Connection>;

    /**
     * Subscribes to router control panel status updates
     *
     * @param params.sessionId Browser session identifier
     * @param params.token Viewer token
     * @param params.listener Status update listener
     * @returns Function that removes the subscription
     * @throws {ApiError} When the session or token is invalid
     */
    subscribe(params: SubscribeRouterSessionStatusParams): () => boolean;

    /**
     * Marks a viewer interaction for a router control panel session
     *
     * @param params.sessionId Browser session identifier
     * @param params.token Viewer token
     * @throws {ApiError} When the session or token is invalid
     */
    markInteraction(params: MarkRouterSessionInteractionParams): void;

    /**
     * Closes every active router control panel session
     */
    closeAll(): Promise<void>;
}
