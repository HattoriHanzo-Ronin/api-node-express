import ArcherAX53Router from "./tp-link/archer-ax53.js";
import TLWDR5620GigabitEditionRouter from "./tp-link/tl-wdr5620-gigabit-edition.js";

/**
 * Resolves router implementations
 *
 * @author HattoriHanzo-Ronin
 */
export default class RouterResolver {
    static getRouter(router) {
        switch (router.model) {
            case "TP-Link TL-WDR5620 Gigabit Edition": {
                return new TLWDR5620GigabitEditionRouter(router);
            }
            case "TP-Link Archer AX53": {
                return new ArcherAX53Router(router);
            }
            default:
                return null;
        }
    }
}
