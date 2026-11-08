import type { WebSocket } from "ws";
import type SocketSessionsFacade from "../socket-sessions-facade.js";
import type {
    SocketSessionAuthParams,
    SocketSessionConnectionParams,
    SocketSessionId,
    SocketSessionNotification,
    SocketSessionOwnedParams
} from "../../types/socket-sessions-service.js";
import type { SocketSessionFacadeSubscribeParams } from "../../types/socket-sessions-facade.js";
import type { SocketSessionsFacadeDependencies } from "../../types/default-socket-sessions-facade.js";
import { API_ERROR } from "../../config/errors.js";
import { SOCKET_ENTITY, USER_ROLE } from "../../config/constants.js";
import ApiError from "../../utils/error/api-error.js";

const { admin, ftp, net } = USER_ROLE;
const { aclPermissionDenied } = API_ERROR;

/**
 * Coordinates WebSocket sessions and subscriptions
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultSocketSessionsFacade implements SocketSessionsFacade<WebSocket> {
    private static readonly ENTITY_ROLES = Object.freeze({
        [SOCKET_ENTITY.devices]: net,
        [SOCKET_ENTITY.whitelist]: net,
        [SOCKET_ENTITY.users]: admin,
        [SOCKET_ENTITY.ftp]: ftp
    });

    private readonly socketSessionsService: SocketSessionsFacadeDependencies<WebSocket>["socketSessionsService"];

    constructor({ socketSessionsService }: SocketSessionsFacadeDependencies<WebSocket>) {
        this.socketSessionsService = socketSessionsService;
    }

    create({ authUser }: SocketSessionAuthParams) {
        return this.socketSessionsService.create({ authUser });
    }

    refresh({ authUser, id }: SocketSessionOwnedParams) {
        return this.socketSessionsService.refresh({ authUser, id });
    }

    async subscribe({ authUser, entities, id, webSocket }: SocketSessionFacadeSubscribeParams<WebSocket>) {
        ApiError.handle([
            {
                condition: entities.some(
                    (entity) => !authUser.roles.includes(DefaultSocketSessionsFacade.ENTITY_ROLES[entity])
                ),
                message: "No tiene permisos para suscribirse a una de las entidades solicitadas",
                status: 403,
                apiError: aclPermissionDenied
            }
        ]);
        await this.socketSessionsService.connect({ authUser, id, webSocket });
        this.socketSessionsService.subscribe({ id, webSocket, entities });
    }

    notify({ entity, data, ownerId }: SocketSessionNotification) {
        this.socketSessionsService.notify({ entity, data, ownerId });
    }

    disconnect({ id, webSocket }: SocketSessionConnectionParams<WebSocket>) {
        this.socketSessionsService.disconnect({ id, webSocket });
    }

    invalidate({ id }: SocketSessionId) {
        this.socketSessionsService.invalidate({ id });
    }

    close({ authUser, id }: SocketSessionOwnedParams) {
        this.socketSessionsService.close({ authUser, id });
    }

    closeAll() {
        this.socketSessionsService.closeAll();
    }
}
