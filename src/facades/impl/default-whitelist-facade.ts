import type WhitelistFacade from "../whitelist-facade.js";
import type RouterAutomation from "../../utils/devices-routers/automation/router-automation.js";
import type { Device } from "../../types/devices/devices-facade.js";
import type { RouterAutomationPayload } from "../../types/utils/router-automation.js";
import type { WhitelistFacadeDependencies } from "../../types/whitelist/default-whitelist-facade.js";
import type { AllowedDevice, WhitelistParams } from "../../types/whitelist/whitelist-facade.js";
import ApiError from "../../utils/error/api-error.js";
import { SOCKET_ENTITY } from "../../config/constants.js";
import { API_ERROR } from "../../config/errors.js";
import { LOG_EVENT } from "../../config/log-events.js";
import Logger from "../../utils/logger/logger.js";

const { deviceNotFound, whitelistRouterNotFound, connectionMacMismatch, routerImplementationNotFound } = API_ERROR;

/**
 * Default whitelist facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultWhitelistFacade<Transaction> implements WhitelistFacade {
    private static readonly LOGGER = Logger.getLogger(DefaultWhitelistFacade);

    constructor(private readonly dependencies: WhitelistFacadeDependencies<Transaction>) {}

    async create({ routerId, allowedDevice }: WhitelistParams) {
        const { id, name, mac } = await this.resolveAllowedDevice(allowedDevice);
        const routerImpl = await this.getRouterImpl(routerId, id);
        const key = await this.dependencies.whitelistService.getKey({
            routerId,
            generateKey: (keys) => routerImpl.generateKey({ keys })
        });
        const result = await this.dependencies.tx(async (clientTx) => {
            await this.dependencies.whitelistService.create({
                clientTx,
                whitelist: { router_id: routerId, connection_mac: mac, key }
            });
            await routerImpl.create({ key, name, mac });
            return { id, mac };
        });
        await this.dependencies.socketSessionsFacade.notify({ entities: [SOCKET_ENTITY.whitelist] });
        DefaultWhitelistFacade.LOGGER.info({
            event: LOG_EVENT.whitelistOperationCompleted,
            message: "Device added in router whitelist",
            context: `Router: ${routerId}, device: ${id}, operation: add`
        });
        return result;
    }

    async delete({ routerId, allowedDevice }: WhitelistParams) {
        const { id, mac } = await this.resolveAllowedDevice(allowedDevice);
        const routerImpl = await this.getRouterImpl(routerId, id);
        const result = await this.dependencies.tx(async (clientTx) => {
            const { key } = await this.dependencies.whitelistService.delete({
                clientTx,
                routerId,
                mac
            });
            await routerImpl.delete({ key, mac });
            return { id, mac };
        });
        await this.dependencies.socketSessionsFacade.notify({ entities: [SOCKET_ENTITY.whitelist] });
        DefaultWhitelistFacade.LOGGER.info({
            event: LOG_EVENT.whitelistOperationCompleted,
            message: "Device removed in router whitelist",
            context: `Router: ${routerId}, device: ${id}, operation: delete`
        });
        return result;
    }

    private async getRouterImpl(id: string, deviceId: string): Promise<RouterAutomation> {
        try {
            const router = await this.dependencies.devicesFacade.getById({ id });
            return new this.dependencies.routerAutomation({ router: router as RouterAutomationPayload });
        } catch (err) {
            if (err instanceof ApiError && err.code === routerImplementationNotFound) {
                DefaultWhitelistFacade.LOGGER.warn({
                    event: LOG_EVENT.routerOperationFailed,
                    message: "Router automation is unavailable",
                    context: `Router: ${id}, device: ${deviceId}`
                });
            }

            ApiError.handle([
                {
                    condition: err instanceof ApiError && err.code === deviceNotFound,
                    message: "El router no existe",
                    status: 404,
                    apiError: whitelistRouterNotFound,
                    cause: err
                }
            ]);
            throw err;
        }
    }

    private async resolveAllowedDevice({ id, mac }: AllowedDevice): Promise<AllowedDevice & Pick<Device, "name">> {
        const { name, connections } = await this.dependencies.devicesFacade.getById({ id });
        ApiError.handle([
            {
                condition: !connections.some(({ mac: connectionMac }) => connectionMac === mac),
                message: "La mac no pertenece al dispositivo especificado",
                status: 400,
                apiError: connectionMacMismatch
            }
        ]);
        return { id, name, mac };
    }
}
