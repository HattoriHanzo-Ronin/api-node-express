import type {
    CloseRouterCpanelParams,
    CreateRouterCpanelParams,
    NavigateRouterCpanelParams,
    RouterCpanelSession
} from "../../../types/utils/router-cpanel.js";

/**
 * Router control panel service client contract
 *
 * @author HattoriHanzo-Ronin
 */
export default interface RouterCpanel {
    /**
     * Creates a router control panel session
     *
     * @param ownerId Authenticated user identifier
     * @param routerName Router display name
     * @param routerIp Router control panel IP address
     * @param routerPassword Router control panel password
     * @param language Viewer language
     * @param clientType Viewer client type
     * @param theme Viewer theme
     * @returns Router control panel session
     */
    create(params: CreateRouterCpanelParams): Promise<RouterCpanelSession>;

    /**
     * Navigates a router control panel session
     *
     * @param sessionId Router control panel session identifier
     * @param ownerId Authenticated user identifier
     * @param action Browser navigation action
     */
    navigate(params: NavigateRouterCpanelParams): Promise<void>;

    /**
     * Deletes a router control panel session
     *
     * @param sessionId Router control panel session identifier
     * @param ownerId Authenticated user identifier
     */
    close(params: CloseRouterCpanelParams): Promise<void>;
}
