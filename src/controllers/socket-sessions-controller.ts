import type {
    SocketSessionsControllerDependencies,
    SocketSessionCreateHandler,
    SocketSessionRefreshHandler,
    SocketSessionCloseHandler
} from "../types/socket-sessions-controller.js";
import idSchema from "../schemas/common/id-schema.js";
import ZodUtils from "../utils/zod-utils.js";

const { validateData } = ZodUtils;

/**
 * Controller for WebSocket sessions
 *
 * @author HattoriHanzo-Ronin
 */
export default class SocketSessionsController {
    private readonly socketSessionsFacade: SocketSessionsControllerDependencies["socketSessionsFacade"];

    constructor({ socketSessionsFacade }: SocketSessionsControllerDependencies) {
        this.socketSessionsFacade = socketSessionsFacade;
    }

    create: SocketSessionCreateHandler = async (req, res) => {
        res.status(201).json(this.socketSessionsFacade.create({ authUser: req.user }));
    };

    refresh: SocketSessionRefreshHandler = async (req, res) => {
        const { params, user: authUser } = req;
        const { id } = validateData(params, idSchema);
        res.json(this.socketSessionsFacade.refresh({ authUser, id }));
    };

    close: SocketSessionCloseHandler = async (req, res) => {
        const { params, user: authUser } = req;
        const { id } = validateData(params, idSchema);
        this.socketSessionsFacade.close({ authUser, id });
        res.status(204).end();
    };
}
