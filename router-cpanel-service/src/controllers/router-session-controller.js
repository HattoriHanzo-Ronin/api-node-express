/**
 * Router control panel session controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class RouterSessionController {
    constructor({ routerSessionService }) {
        this.routerSessionService = routerSessionService;
    }

    create = async (req, res) => {
        const { body } = req;
        const { ownerId, routerName, routerIp, routerPassword, language, clientType, theme } = body;
        res.status(201).json(await this.routerSessionService.create({
            ownerId,
            routerName,
            routerIp,
            routerPassword,
            language,
            clientType,
            theme
        }));
    };

    delete = async (req, res) => {
        const { params, body } = req;
        const { sessionId } = params;
        const { ownerId } = body;
        await this.routerSessionService.close({ sessionId, ownerId });
        res.status(204).send();
    };

    navigate = async (req, res) => {
        const { params, body } = req;
        const { sessionId } = params;
        const { ownerId, action } = body;
        await this.routerSessionService.navigate({ sessionId, ownerId, action });
        res.status(204).send();
    };

    streamStatus = async (req, res) => {
        const { sessionId } = req.params;
        const { token } = req.query;
        res.set({ "Cache-Control": "no-cache", Connection: "keep-alive", "Content-Type": "text/event-stream" }).flushHeaders();
        const listener = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        const unsubscribe = this.routerSessionService.subscribe({ sessionId, token, listener });
        req.once("close", unsubscribe);
    };

    markInteraction = async (req, res) => {
        const { sessionId } = req.params;
        const { token } = req.query;
        this.routerSessionService.markInteraction({ sessionId, token });
        res.status(204).send();
    };
}
