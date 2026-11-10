import { WebSocketServer } from "ws";
import type { Server } from "node:http";
import type { Socket } from "node:net";
import type { RawData } from "ws";
import type VncGateway from "../vnc-gateway.js";
import type RouterSessionService from "../../../services/router-session-service.js";
import type { BridgeVncConnectionParams, NoVncGatewayDependencies } from "../../../types/utils/no-vnc-gateway.js";

/**
 * Bridges authenticated noVNC WebSockets to local VNC sockets
 *
 * @author HattoriHanzo-Ronin
 */
export default class NoVncGateway implements VncGateway<Server> {
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
        let vncSocket: Awaited<ReturnType<RouterSessionService<Socket>["openVncSocket"]>>;
        try {
            vncSocket = await this.routerSessionService.openVncSocket({ sessionId, token });
        } catch {
            webSocket.close(1008, "Sesión no válida");
            return;
        }

        webSocket.on("message", (data: RawData) => {
            this.routerSessionService.refresh({ sessionId });
            vncSocket.write(NoVncGateway.toBuffer(data));
        });
        webSocket.once("close", () => vncSocket.destroy());
        vncSocket.on("data", (data) => {
            this.routerSessionService.refresh({ sessionId });
            webSocket.send(data);
        });
        vncSocket.once("close", () => webSocket.close());
        vncSocket.once("error", () => webSocket.close(1011, "Conexión VNC cerrada"));
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
