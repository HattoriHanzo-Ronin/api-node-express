import type DataVersionsFacade from "../../facades/data-versions-facade.js";
import type SocketSessionsService from "../../services/socket-sessions-service.js";

export type SocketSessionsFacadeDependencies<Socket> = {
    socketSessionsService: SocketSessionsService<Socket>;
    dataVersionsFacade: DataVersionsFacade;
};
