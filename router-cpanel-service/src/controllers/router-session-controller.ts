import type { RouterSessionStatus } from "../types/router-session/router-session-service.js";
import type {
    CreateRouterSessionHandler,
    DeleteRouterSessionHandler,
    NavigateRouterSessionHandler,
    StreamRouterSessionStatusHandler,
    MarkRouterSessionInteractionHandler,
    RouterSessionControllerDependencies
} from "../types/router-session/router-session-controller.js";

/**
 * Router control panel session controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class RouterSessionController {
    private readonly routerSessionService: RouterSessionControllerDependencies["routerSessionService"];

    constructor({ routerSessionService }: RouterSessionControllerDependencies) {
        this.routerSessionService = routerSessionService;
    }

    create: CreateRouterSessionHandler = async (req, res) => {
        const {
            body: { ownerId, routerName, routerIp, routerPassword, language, clientType, theme }
        } = req;
        res.status(201).json(
            await this.routerSessionService.create({
                ownerId,
                routerName,
                routerIp,
                routerPassword,
                language,
                clientType,
                theme
            })
        );
    };

    delete: DeleteRouterSessionHandler = async (req, res) => {
        const {
            params: { sessionId },
            body: { ownerId }
        } = req;
        await this.routerSessionService.close({ sessionId, ownerId });
        res.status(204).send();
    };

    navigate: NavigateRouterSessionHandler = async (req, res) => {
        const {
            params: { sessionId },
            body: { ownerId, action }
        } = req;
        await this.routerSessionService.navigate({ sessionId, ownerId, action });
        res.status(204).send();
    };

    streamStatus: StreamRouterSessionStatusHandler = (req, res) => {
        const {
            params: { sessionId },
            query: { token }
        } = req;
        res.set({
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Content-Type": "text/event-stream"
        }).flushHeaders();
        const listener = (data: RouterSessionStatus): boolean => res.write(`data: ${JSON.stringify(data)}\n\n`);
        const unsubscribe = this.routerSessionService.subscribe({ sessionId, token, listener });
        req.once("close", unsubscribe);
    };

    markInteraction: MarkRouterSessionInteractionHandler = (req, res) => {
        const {
            params: { sessionId },
            query: { token }
        } = req;
        this.routerSessionService.markInteraction({ sessionId, token });
        res.status(204).send();
    };
}
