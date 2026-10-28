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
        const { body: { ownerId, routerName, routerIp, routerPassword, language, clientType, theme } } = req;
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
        const { params: { sessionId }, body: { ownerId } } = req;
        await this.routerSessionService.close({ sessionId, ownerId });
        res.status(204).send();
    };

    navigate = async (req, res) => {
        const { params: { sessionId }, body: { ownerId, action } } = req;
        await this.routerSessionService.navigate({ sessionId, ownerId, action });
        res.status(204).send();
    };

    streamStatus = async (req, res) => {
        const { params: { sessionId }, query: { token } } = req;
        res.set({ "Cache-Control": "no-cache", Connection: "keep-alive", "Content-Type": "text/event-stream" }).flushHeaders();
        const listener = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        const unsubscribe = this.routerSessionService.subscribe({ sessionId, token, listener });
        req.once("close", unsubscribe);
    };

    markInteraction = async (req, res) => {
        const { params: { sessionId }, query: { token } } = req;
        this.routerSessionService.markInteraction({ sessionId, token });
        res.status(204).send();
    };
}
