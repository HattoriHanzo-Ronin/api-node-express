import { WebSocketServer } from "ws";
import { API_ERROR } from "../../config/errors.js";
import { dataVersionsSchema } from "../../schemas/data-versions-schema.js";
import ApiError from "../error/api-error.js";
import ZodUtils from "../zod-utils.js";

const { internalError, invalidToken, socketSessionInvalid } = API_ERROR;
const { validateData } = ZodUtils;

/**
 * Authenticates WebSocket clients and binds them to socket sessions
 *
 * @author HattoriHanzo-Ronin
 */
export default class SocketGateway {
    #socketSessionsFacade;
    #accessTokenProvider;
    #webSocketServer;

    constructor({ socketSessionsFacade, accessTokenProvider }) {
        this.#socketSessionsFacade = socketSessionsFacade;
        this.#accessTokenProvider = accessTokenProvider;
        this.#webSocketServer = new WebSocketServer({ noServer: true });
    }

    /**
     * Attaches the WebSocket upgrade handler to a HTTP server
     *
     * @param {import("node:http").Server} params.server HTTP server
     */
    attach({ server }) {
        server.on("upgrade", (request, socket, head) => {
            const url = new URL(request.url, `http://${request.headers.host}`);
            const match = url.pathname.match(/^\/events\/([^/]+)$/);
            if (!match) {
                socket.destroy();
                return;
            }

            this.#webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
                this.#watchMessages({ sessionId: match[1], webSocket });
            });
        });
    }

    /**
     * Closes every active WebSocket
     */
    close() {
        this.#webSocketServer.clients.forEach((webSocket) => webSocket.close());
        this.#webSocketServer.close();
    }

    #watchMessages({ sessionId, webSocket }) {
        let connected = false;
        webSocket.once("close", () => {
            this.#socketSessionsFacade.disconnect({ id: sessionId, webSocket });
        });
        webSocket.on("message", async (data, isBinary) => {
            let message;
            let authUser;
            try {
                message = SocketGateway.#getMessage({ data, isBinary });
                authUser = this.#getAuthUser({ accessToken: message.accessToken });
            } catch (err) {
                this.#sendError({ err, webSocket });
                this.#socketSessionsFacade.invalidate({ id: sessionId });
                webSocket.close(1008, "Sesión no válida");
                return;
            }

            try {
                const { dir, entities } = validateData({ dir: message.dir, entities: message.entities }, dataVersionsSchema);
                if (!connected) {
                    this.#socketSessionsFacade.connect({ authUser, id: sessionId, webSocket });
                    connected = true;
                }

                webSocket.send(JSON.stringify(await this.#socketSessionsFacade.getVersions({ authUser, dir, entities, id: sessionId, webSocket })));
            } catch (err) {
                this.#sendError({ err, webSocket });
            }
        });
    }

    #getAuthUser({ accessToken }) {
        try {
            return this.#accessTokenProvider.verify({ token: accessToken });
        } catch {
            throw new ApiError({ message: "Token no válido", status: 401, apiError: invalidToken });
        }
    }

    #sendError({ err, webSocket }) {
        const isApiError = err instanceof ApiError;
        webSocket.send(JSON.stringify({
            code: isApiError ? err.code : internalError,
            message: isApiError ? err.message : "Error inesperado"
        }));
    }

    static #getMessage({ data, isBinary }) {
        if (isBinary) {
            throw new ApiError({ message: "La sesión de notificaciones no es válida", status: 401, apiError: socketSessionInvalid });
        }

        const message = JSON.parse(data.toString());
        if (typeof message.accessToken !== "string") {
            throw new ApiError({ message: "La sesión de notificaciones no es válida", status: 401, apiError: socketSessionInvalid });
        }

        return message;
    }
}
