import { API_ERROR } from "../config/errors.js";
import { SOCKET_ENTITY, USER_ROLE } from "../config/constants.js";
import ApiError from "../utils/error/api-error.js";

const { admin, ftp, net } = USER_ROLE;
const { aclPermissionDenied } = API_ERROR;

/**
 * Coordinates WebSocket sessions and subscriptions
 *
 * @author HattoriHanzo-Ronin
 */
export default class SocketSessionsFacade {
    static #ENTITY_ROLES = Object.freeze({
        [SOCKET_ENTITY.devices]: net,
        [SOCKET_ENTITY.whitelist]: net,
        [SOCKET_ENTITY.users]: admin,
        [SOCKET_ENTITY.ftp]: ftp
    });

    #socketSessionsService;

    constructor({ socketSessionsService }) {
        this.#socketSessionsService = socketSessionsService;
    }

    /**
     * Creates a WebSocket session
     *
     * @param {Object} params.authUser Authenticated user
     * @returns {{ id: string, expiresAt: string }} Socket session
     */
    create({ authUser }) {
        return this.#socketSessionsService.create({ authUser });
    }

    /**
     * Refreshes a WebSocket session
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.id Socket session identifier
     * @returns {{ id: string, expiresAt: string }} Socket session
     */
    refresh({ authUser, id }) {
        return this.#socketSessionsService.refresh({ authUser, id });
    }

    /**
     * Subscribes a WebSocket session to authorized entity changes
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string[]} params.entities Requested entities
     * @param {string} params.id Socket session identifier
     * @param {import("ws").WebSocket} params.webSocket WebSocket connection
     */
    async subscribe({ authUser, entities, id, webSocket }) {
        ApiError.handle([{
            condition: entities.some((entity) => !authUser.roles.includes(SocketSessionsFacade.#ENTITY_ROLES[entity])),
            message: "No tiene permisos para suscribirse a una de las entidades solicitadas",
            status: 403,
            apiError: aclPermissionDenied
        }]);
        await this.#socketSessionsService.connect({ authUser, id, webSocket });
        this.#socketSessionsService.subscribe({ id, webSocket, entities });
    }

    /**
     * Notifies subscribed sockets about an entity change
     *
     * @param {string} params.entity Changed entity identifier
     * @param {Object | undefined} [params.data] Additional event data
     * @param {string | undefined} [params.ownerId] Owner identifier for private resources
     */
    notify({ entity, data, ownerId }) {
        this.#socketSessionsService.notify({ entity, data, ownerId });
    }

    /**
     * Disconnects a WebSocket from its session
     *
     * @param {string} params.id Socket session identifier
     * @param {import("ws").WebSocket} params.webSocket WebSocket connection
     */
    disconnect({ id, webSocket }) {
        this.#socketSessionsService.disconnect({ id, webSocket });
    }

    /**
     * Invalidates a WebSocket session
     *
     * @param {string} params.id Socket session identifier
     */
    invalidate({ id }) {
        this.#socketSessionsService.invalidate({ id });
    }

    /**
     * Closes a WebSocket session
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.id Socket session identifier
     */
    close({ authUser, id }) {
        this.#socketSessionsService.close({ authUser, id });
    }

    /**
     * Closes every WebSocket session
     */
    closeAll() {
        this.#socketSessionsService.closeAll();
    }
}
