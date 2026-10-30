import type { RouterSessionControllerHandlers } from "../types/router-session-controller.js";

/**
 * Router control panel session controller contract
 *
 * @author HattoriHanzo-Ronin
 * @typeParam Handlers Handler map used by the concrete HTTP implementation
 */
export interface RouterSessionController<Handlers extends RouterSessionControllerHandlers> {
    /**
     * Handler that creates a router control panel session
     */
    create: Handlers["create"];

    /**
     * Handler that closes a router control panel session
     */
    delete: Handlers["delete"];

    /**
     * Handler that navigates a router control panel session
     */
    navigate: Handlers["navigate"];

    /**
     * Handler that streams router control panel status updates
     */
    streamStatus: Handlers["streamStatus"];

    /**
     * Handler that marks a router control panel viewer interaction
     */
    markInteraction: Handlers["markInteraction"];
}
