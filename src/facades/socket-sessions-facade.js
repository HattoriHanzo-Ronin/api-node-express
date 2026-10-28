import { USER_ROLE } from "../config/constants.js";
import { API_ERROR } from "../config/errors.js";
import ApiError from "../utils/error/api-error.js";

const { admin, ftp, net } = USER_ROLE;
const { aclPermissionDenied } = API_ERROR;

/**
 * Coordinates WebSocket sessions and version queries
 *
 * @author HattoriHanzo-Ronin
 */
export default class SocketSessionsFacade {
    static #ENTITY_ROLES = Object.freeze({ devices: net, whitelist: net, users: admin, ftp });

    constructor({ socketSessionsService, dataVersionsFacade }) {
        this.socketSessionsService = socketSessionsService;
        this.dataVersionsFacade = dataVersionsFacade;
    }

    /**
     * Creates a WebSocket session
     *
     * @param {Object} params.authUser Authenticated user
     * @returns {{ id: string, expiresAt: string }} Socket session
     */
    create({ authUser }) {
        return this.socketSessionsService.create({ authUser });
    }

    /**
     * Refreshes a WebSocket session
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.id Socket session identifier
     * @returns {{ id: string, expiresAt: string }} Socket session
     */
    refresh({ authUser, id }) {
        return this.socketSessionsService.refresh({ authUser, id });
    }

    /**
     * Connects a WebSocket session
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.id Socket session identifier
     * @param {import("ws").WebSocket} params.webSocket WebSocket connection
     */
    connect({ authUser, id, webSocket }) {
        this.socketSessionsService.activity({ authUser, id, webSocket });
    }

    /**
     * Returns authorized data versions through a WebSocket session
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.dir FTP directory path
     * @param {string[]} params.entities Requested entities
     * @param {string} params.id Socket session identifier
     * @param {import("ws").WebSocket} params.webSocket WebSocket connection
     * @returns {Promise<Object<string, string>>} Data versions
     */
    async getVersions({ authUser, dir, entities, id, webSocket }) {
        this.socketSessionsService.activity({ authUser, id, webSocket });
        ApiError.handle([{
            condition: entities.some((entity) => !authUser.roles.includes(SocketSessionsFacade.#ENTITY_ROLES[entity])),
            message: "No tiene permisos para consultar una de las versiones solicitadas",
            status: 403,
            apiError: aclPermissionDenied
        }]);
        const databaseEntities = entities.filter((entity) => entity !== "ftp");
        const dataVersions = databaseEntities.length > 0
            ? await this.dataVersionsFacade.getById({ id: databaseEntities })
            : {};
        if (!entities.includes("ftp")) {
            return dataVersions;
        }

        const { version } = await this.dataVersionsFacade.getFtp({ dir, authUser });
        return { ...dataVersions, ftp: version };
    }

    /**
     * Disconnects a WebSocket from its session
     *
     * @param {string} params.id Socket session identifier
     * @param {import("ws").WebSocket} params.webSocket WebSocket connection
     */
    disconnect({ id, webSocket }) {
        this.socketSessionsService.disconnect({ id, webSocket });
    }

    /**
     * Invalidates a WebSocket session
     *
     * @param {string} params.id Socket session identifier
     */
    invalidate({ id }) {
        this.socketSessionsService.invalidate({ id });
    }

    /**
     * Closes a WebSocket session
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.id Socket session identifier
     */
    close({ authUser, id }) {
        this.socketSessionsService.close({ authUser, id });
    }

    /**
     * Closes every WebSocket session
     */
    closeAll() {
        this.socketSessionsService.closeAll();
    }
}
