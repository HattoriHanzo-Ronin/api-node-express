import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import type { Server } from "node:http";
import { API_ERROR } from "../../../config/errors.js";
import { SOCKET_SUBSCRIPTION_SCHEMA } from "../../../schemas/socket-sessions-schema.js";
import ApiError from "../../error/api-error.js";
import ZodUtils from "../../zod-utils.js";
import SocketGateway from "../socket-gateway.js";
import type {
    SocketEventsGetMessage,
    SocketEventsMessagesParams,
    SocketEventsGatewayDependencies,
    SocketEventsMessage,
    SocketEventsSendError
} from "../../../types/socket-events-gateway.js";
import type SocketSessionsFacade from "../../../facades/socket-sessions-facade.js";

const { internalError, socketSessionInvalid } = API_ERROR;
const { validateData } = ZodUtils;

/**
 * Authenticates WebSocket clients and binds them to socket sessions
 *
 * @author HattoriHanzo-Ronin
 */
export default class SocketEventsGateway implements SocketGateway<Server> {
    private readonly socketSessionsFacade: SocketSessionsFacade<WebSocket>;
    private readonly accessTokenProvider;
    private readonly webSocketServer;

    constructor({ socketSessionsFacade, accessTokenProvider }: SocketEventsGatewayDependencies) {
        this.socketSessionsFacade = socketSessionsFacade;
        this.accessTokenProvider = accessTokenProvider;
        this.webSocketServer = new WebSocketServer({ noServer: true });
    }

    attach({ server }: { server: Server }) {
        server.on("upgrade", (request, socket, head) => {
            const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
            const match = url.pathname.match(/^\/events\/([^/]+)$/);
            if (!match) {
                socket.destroy();
                return;
            }

            this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
                this.watchMessages({ sessionId: match[1], webSocket });
            });
        });
    }

    close() {
        this.webSocketServer.clients.forEach((webSocket) => webSocket.close());
        this.webSocketServer.close();
    }

    private watchMessages({ sessionId, webSocket }: SocketEventsMessagesParams): void {
        webSocket.once("close", () => {
            this.socketSessionsFacade.disconnect({ id: sessionId, webSocket });
        });
        webSocket.once("message", async (data, isBinary) => {
            try {
                const { accessToken, entities: requestedEntities } = SocketEventsGateway.getMessage({ data, isBinary });
                const authUser = this.accessTokenProvider.verify({ token: accessToken });
                const { entities } = validateData({ entities: requestedEntities }, SOCKET_SUBSCRIPTION_SCHEMA);
                await this.socketSessionsFacade.subscribe({ authUser, entities, id: sessionId, webSocket });
            } catch (err) {
                this.sendError({ err, webSocket });
                this.socketSessionsFacade.invalidate({ id: sessionId });
                webSocket.close(1008, "Sesión no válida");
            }
        });
    }

    private sendError({ err, webSocket }: SocketEventsSendError): void {
        const isApiError = err instanceof ApiError;
        webSocket.send(
            JSON.stringify({
                code: isApiError ? err.code : internalError,
                message: isApiError ? err.message : "Error inesperado"
            })
        );
    }

    private static getMessage({ data, isBinary }: SocketEventsGetMessage): SocketEventsMessage {
        if (isBinary) {
            SocketEventsGateway.invalidSession();
        }

        let message: unknown;
        try {
            message = JSON.parse(data.toString());
        } catch {
            SocketEventsGateway.invalidSession();
        }

        if (
            message === null ||
            typeof message !== "object" ||
            !("accessToken" in message) ||
            typeof message.accessToken !== "string"
        ) {
            SocketEventsGateway.invalidSession();
        }

        return {
            accessToken: message.accessToken,
            entities: "entities" in message ? message.entities : undefined
        };
    }

    private static invalidSession(): never {
        throw new ApiError({
            message: "La sesión de notificaciones no es válida",
            status: 401,
            apiError: socketSessionInvalid
        });
    }
}
