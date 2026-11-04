/**
 * VNC gateway contract
 *
 * @author HattoriHanzo-Ronin
 */
export default interface SocketGateway<Server> {
    /**
     * Attaches the gateway to a server
     *
     * @param params.server Server that receives gateway connections
     */
    attach(params: { server: Server }): void;

    /**
     * Closes active gateway connections
     */
    close(): void;
}
