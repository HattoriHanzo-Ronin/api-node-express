import ApiError from "../../../error/api-error.js";
import { API_ERROR } from "../../../../config/errors.js";
import ArcherAX53Router from "../routers/tp-link/archer-ax53.js";
import TLWDR5620GigabitEditionRouter from "../routers/tp-link/tl-wdr5620-gigabit-edition.js";
import {
    AddAllowParams,
    DeleteAllowParams,
    GeneratedKeysParams,
    RouterAutomationPayload
} from "../../../../types/utils/router-automation.js";
import type { RouterAutomationImplementations } from "../../../../types/utils/router-automation-manager.js";
import AbstractRouter from "../routers/abstract-router.js";
import RouterAutomation from "../router-automation.js";

const { routerImplementationNotFound, routerAddFailed, routerDeleteFailed } = API_ERROR;

/**
 * Router automation manager
 *
 * @author HattoriHanzo-Ronin
 */
export default class RouterAutomationManager implements RouterAutomation {
    private static readonly IMPLEMENTATIONS: RouterAutomationImplementations = Object.freeze({
        "TP-Link TL-WDR5620 Gigabit Edition": TLWDR5620GigabitEditionRouter,
        "TP-Link Archer AX53": ArcherAX53Router
    } as const);

    private readonly router: AbstractRouter;

    constructor({ router }: { router: RouterAutomationPayload }) {
        const RouterImplementation = RouterAutomationManager.IMPLEMENTATIONS[router.model];
        ApiError.handle([
            {
                condition: !RouterImplementation,
                message: `${router.name} no tiene implementación disponible`,
                apiError: routerImplementationNotFound,
                status: 400
            }
        ]);
        this.router = new RouterImplementation({ router });
    }

    getCapabilities() {
        return this.router.getCapabilities();
    }

    generateKey({ keys }: GeneratedKeysParams) {
        return this.router.generateKey({ keys });
    }

    async create({ key, mac, name }: AddAllowParams) {
        if (!this.getCapabilities().addAllow) {
            return;
        }

        const added = await this.router.addAllow({ key, mac, name });
        ApiError.handle([
            {
                condition: !added,
                message: `Error al insertar el dispositivo en el router`,
                status: 400,
                apiError: routerAddFailed
            }
        ]);
    }

    async delete({ key, mac }: DeleteAllowParams) {
        if (!this.getCapabilities().deleteAllow) {
            return;
        }

        const deleted = await this.router.deleteAllow({ key, mac });
        ApiError.handle([
            {
                condition: !deleted,
                message: "Error al eliminar el dispositivo del router",
                status: 400,
                apiError: routerDeleteFailed
            }
        ]);
    }
}
