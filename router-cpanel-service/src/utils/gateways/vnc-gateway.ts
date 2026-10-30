/**
 * VNC gateway contract
 *
 * @author HattoriHanzo-Ronin
 */
export interface VncGateway<Server> {
    /**
     * Attaches the VNC WebSocket upgrade handler to a HTTP server
     *
     * @param params.server HTTP server
     */
    attach(params: { server: Server }): void;

    /**
     * Closes every active WebSocket
     */
    close(): void;
}
