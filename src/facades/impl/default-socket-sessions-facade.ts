import type { AuthUserParams } from "../../types/auth/auth-facade.js";
import type { WebSocket } from "ws";
import type SocketSessionsFacade from "../socket-sessions-facade.js";
import type {
    SocketSessionConnectionParams,
    SocketSessionId,
    SocketSessionNotification,
    SocketSessionOwnedParams
} from "../../types/socket-sessions/socket-sessions-service.js";
import type {
    SocketSessionFacadeSubscribeParams,
    SocketSessionsVersionsNotification
} from "../../types/socket-sessions/socket-sessions-facade.js";
import type { SocketSessionsFacadeDependencies } from "../../types/socket-sessions/default-socket-sessions-facade.js";
import { API_ERROR } from "../../config/errors.js";
import { SOCKET_ENTITY, USER_ROLE } from "../../config/constants.js";
import ApiError from "../../utils/error/api-error.js";
import Logger from "../../utils/logger/logger.js";
import { LOG_EVENT } from "../../config/log-events.js";

const { admin, ftp, net } = USER_ROLE;
const { aclPermissionDenied } = API_ERROR;

/**
 * Coordinates WebSocket sessions and subscriptions
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultSocketSessionsFacade implements SocketSessionsFacade<WebSocket> {
    private static readonly LOGGER = Logger.getLogger(DefaultSocketSessionsFacade);
    private static readonly ENTITY_ROLES = Object.freeze({
        [SOCKET_ENTITY.devices]: net,
        [SOCKET_ENTITY.whitelist]: net,
        [SOCKET_ENTITY.users]: admin,
        [SOCKET_ENTITY.ftp]: ftp
    });

    constructor(private readonly dependencies: SocketSessionsFacadeDependencies<WebSocket>) {}

    create({ authUser }: AuthUserParams) {
        return this.dependencies.socketSessionsService.create({ authUser });
    }

    refresh({ authUser, id }: SocketSessionOwnedParams) {
        return this.dependencies.socketSessionsService.refresh({ authUser, id });
    }

    async subscribe({ authUser, entities, id, webSocket }: SocketSessionFacadeSubscribeParams<WebSocket>) {
        ApiError.handle([
            {
                condition: entities.some(
                    (entity) => !authUser.roles.includes(DefaultSocketSessionsFacade.ENTITY_ROLES[entity])
                ),
                execute: () => {
                    DefaultSocketSessionsFacade.LOGGER.warn({
                        event: LOG_EVENT.authorizationDenied,
                        message: "Authenticated user attempted a restricted socket subscription",
                        context: `User: ${authUser.id}, entities: ${entities.join(", ")}`
                    });
                },
                message: "No tiene permisos para suscribirse a una de las entidades solicitadas",
                status: 403,
                apiError: aclPermissionDenied
            }
        ]);
        await this.dependencies.socketSessionsService.connect({ authUser, id, webSocket });
        this.dependencies.socketSessionsService.subscribe({ id, webSocket, entities });
    }

    notify(params: SocketSessionsVersionsNotification): Promise<void>;
    notify(params: SocketSessionNotification): void;
    notify(params: SocketSessionsVersionsNotification | SocketSessionNotification): Promise<void> | void {
        if ("entities" in params) {
            return this.notifyVersions(params);
        }

        return this.dependencies.socketSessionsService.notify(params);
    }

    disconnect({ id, webSocket }: SocketSessionConnectionParams<WebSocket>) {
        this.dependencies.socketSessionsService.disconnect({ id, webSocket });
    }

    invalidate({ id }: SocketSessionId) {
        this.dependencies.socketSessionsService.invalidate({ id });
    }

    close({ authUser, id }: SocketSessionOwnedParams) {
        this.dependencies.socketSessionsService.close({ authUser, id });
    }

    closeAll() {
        this.dependencies.socketSessionsService.closeAll();
    }

    private async notifyVersions({ entities }: SocketSessionsVersionsNotification): Promise<void> {
        if (entities.length === 0) {
            return;
        }

        if (entities.length === 1) {
            const [entity] = entities;
            const { version } = await this.dependencies.dataVersionsFacade.getById({ id: entity });
            this.dependencies.socketSessionsService.notify({ entity, data: { version } });
            return;
        }

        const versions = await this.dependencies.dataVersionsFacade.getById({ id: entities });
        for (const entity of entities) {
            this.dependencies.socketSessionsService.notify({ entity, data: { version: versions[entity] } });
        }
    }
}
