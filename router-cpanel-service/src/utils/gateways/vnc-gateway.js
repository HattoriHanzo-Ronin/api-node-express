import { WebSocketServer } from "ws";

/**
 * Bridges authenticated noVNC WebSockets to local VNC sockets
 *
 * @author HattoriHanzo-Ronin
 */
export default class VncGateway {
    #routerSessionService;
    #webSocketServer;

    constructor({ routerSessionService }) {
        this.#routerSessionService = routerSessionService;
        this.#webSocketServer = new WebSocketServer({ noServer: true });
    }

    /**
     * Attaches the VNC WebSocket upgrade handler to a HTTP server
     *
     * @param {import("node:http").Server} params.server HTTP server
     */
    attach({ server }) {
        server.on("upgrade", (request, socket, head) => {
            const url = new URL(request.url, `http://${request.headers.host}`);
            const match = url.pathname.match(/^\/vnc\/([^/]+)\/socket$/);
            if (!match) {
                socket.destroy();
                return;
            }

            this.#webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
                void this.#bridge({ webSocket, sessionId: match[1], token: url.searchParams.get("token") ?? "" });
            });
        });
    }

    /**
     * Closes every active WebSocket
     */
    close() {
        this.#webSocketServer.clients.forEach((client) => client.close());
        this.#webSocketServer.close();
    }

    async #bridge({ webSocket, sessionId, token }) {
        let vncSocket;
        try {
            vncSocket = await this.#routerSessionService.openVncSocket({ sessionId, token });
        } catch {
            webSocket.close(1008, "Sesión no válida");
            return;
        }

        webSocket.on("message", (data) => {
            this.#routerSessionService.refresh({ sessionId });
            vncSocket.write(data);
        });
        webSocket.once("close", () => vncSocket.destroy());
        vncSocket.on("data", (data) => {
            this.#routerSessionService.refresh({ sessionId });
            webSocket.send(data);
        });
        vncSocket.once("close", () => webSocket.close());
        vncSocket.once("error", () => webSocket.close(1011, "Conexión VNC cerrada"));
    }
}
