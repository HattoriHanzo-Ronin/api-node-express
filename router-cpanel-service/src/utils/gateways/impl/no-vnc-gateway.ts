import { WebSocketServer } from "ws";
import type { Server } from "node:http";
import type { Socket } from "node:net";
import type { RawData } from "ws";
import type VncGateway from "../vnc-gateway.js";
import type RouterSessionService from "../../../services/router-session-service.js";
import type { BridgeVncConnectionParams, NoVncGatewayDependencies } from "../../../types/utils/no-vnc-gateway.js";
import { LOG_EVENT } from "../../../config/log-events.js";
import ApiError from "../../error/api-error.js";
import Logger from "../../logger/logger.js";

/**
 * Bridges authenticated noVNC WebSockets to local VNC sockets
 *
 * @author HattoriHanzo-Ronin
 */
export default class NoVncGateway implements VncGateway<Server> {
    private static readonly LOGGER = Logger.getLogger(NoVncGateway);
    private readonly routerSessionService: NoVncGatewayDependencies["routerSessionService"];
    private readonly webSocketServer: WebSocketServer;

    constructor({ routerSessionService }: NoVncGatewayDependencies) {
        this.routerSessionService = routerSessionService;
        this.webSocketServer = new WebSocketServer({ noServer: true });
    }

    attach({ server }: { server: Server }) {
        server.on("upgrade", (request, socket, head) => {
            const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
            const match = url.pathname.match(/^\/vnc\/([^/]+)\/socket$/);
            if (!match) {
                socket.destroy();
                return;
            }

            this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
                void this.bridge({ webSocket, sessionId: match[1], token: url.searchParams.get("token") ?? "" });
            });
        });
    }

    close() {
        this.webSocketServer.clients.forEach((client) => client.close());
        this.webSocketServer.close();
    }

    private async bridge({ webSocket, sessionId, token }: BridgeVncConnectionParams): Promise<void> {
        const { vncSocketFailed, vncConnectionFailed, vncDisconnected } = LOG_EVENT;
        webSocket.on("error", (error) => {
            NoVncGateway.LOGGER.error({ event: vncSocketFailed, message: "VNC WebSocket failed", error });
        });
        let vncSocket: Awaited<ReturnType<RouterSessionService<Socket>["openVncSocket"]>>;
        try {
            vncSocket = await this.routerSessionService.openVncSocket({ sessionId, token });
        } catch (error) {
            if (!(error instanceof ApiError)) {
                NoVncGateway.LOGGER.error({
                    event: vncConnectionFailed,
                    message: "VNC connection failed",
                    error
                });
            }

            webSocket.close(1008, "Sesión no válida");
            return;
        }

        webSocket.on("message", (data: RawData) => {
            this.routerSessionService.refresh({ sessionId });
            vncSocket.write(NoVncGateway.toBuffer(data));
        });
        webSocket.once("close", (code) => {
            if (code === 1006 || code === 1011) {
                NoVncGateway.LOGGER.warn({
                    event: vncDisconnected,
                    message: "VNC WebSocket disconnected unexpectedly",
                    context: `Session: ${sessionId}, code: ${code}`
                });
            }

            vncSocket.destroy();
        });
        vncSocket.on("data", (data) => {
            this.routerSessionService.refresh({ sessionId });
            webSocket.send(data);
        });
        vncSocket.once("close", () => webSocket.close());
        vncSocket.once("error", (error) => {
            NoVncGateway.LOGGER.error({
                event: vncSocketFailed,
                message: "VNC socket failed",
                context: `Session: ${sessionId}`,
                error
            });
            webSocket.close(1011, "Conexión VNC cerrada");
        });
    }

    private static toBuffer(data: RawData): Buffer {
        if (Array.isArray(data)) {
            return Buffer.concat(data);
        }

        if (data instanceof ArrayBuffer) {
            return Buffer.from(data);
        }

        return Buffer.from(data);
    }
}
