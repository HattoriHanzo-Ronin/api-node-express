import PostgresClient from "../config/db/postgres-client.js";
import RouterResolver from "../device-routers/router-resolver.js";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * Whitelist service
 *
 * @author HattoriHanzo-Ronin
 */
export default class WhitelistService {
    constructor({ whitelistModel }) {
        this.whitelistModel = whitelistModel;
    }

    /**
     * Creates a whitelist entry
     *
     * @param {Object} params.router Router data
     * @param {Object} params.allowDevice Allowed device data
     * @returns {{ router_id: string, allow_device_id: string }} Created whitelist entry
     */
    async create({ router, allowDevice }) {
        try {
            const { id: router_id } = router;
            const { id: allow_device_id, mac: deviceMac, name: deviceName } = allowDevice;
            const routerImpl = getRouterImpl(router);
            const keys = await this.whitelistModel.getKeys({ router_id });
            const key = routerImpl.getKey(keys);
            return await client.tx(async (clientTx) => {
                const result = await this.whitelistModel.insert({
                    clientTx,
                    whitelist: { router_id, allow_device_id, key }
                });
                const capabilities = routerImpl.getCapabilities();
                if (capabilities.addAllow) {
                    const added = await routerImpl.addAllow({ key, deviceMac, deviceName });
                    handleApiErrors([
                        { condition: !added, message: "Error al insertar el dispositivo en el router", status: 400 }
                    ]);
                }

                return result;
            });
        } catch (err) {
            handleApiErrors([
                {
                    condition: err.code === "23503",
                    execute: () =>
                        handleApiErrors([
                            {
                                condition: err.constraint === "fk_whitelist_router",
                                message: "El router no existe",
                                status: 404
                            },
                            {
                                condition: err.constraint === "fk_whitelist_allow_device",
                                message: "El dispositivo no existe",
                                status: 404
                            }
                        ])
                },
                { condition: err.code === "23505", message: "El dispositivo ya se encuentra autorizado", status: 400 }
            ]);
            throw err;
        }
    }

    /**
     * Deletes a whitelist entry
     *
     * @param {Object} params.router Router data
     * @param {Object} params.allowDevice Allowed device data
     * @returns {{ router_id: string, allow_device_id: string }} Deleted whitelist entry
     */
    async delete({ router, allowDevice }) {
        const { id: routerId } = router;
        const { id: allowDeviceId, mac: deviceMac } = allowDevice;
        const routerImpl = getRouterImpl(router);
        return client.tx(async (clientTx) => {
            const result = await this.whitelistModel.delete({ clientTx, routerId, allowDeviceId });
            handleApiErrors([
                { condition: !result, message: "El dispositivo no se encuentra autorizado", status: 404 }
            ]);
            const { key, ...response } = result;
            const capabilities = routerImpl.getCapabilities();
            if (capabilities.deleteAllow) {
                const deleted = await routerImpl.deleteAllow({ key, deviceMac });
                handleApiErrors([
                    { condition: !deleted, message: "Error al eliminar el dispositivo del router", status: 400 }
                ]);
            }

            return response;
        });
    }
}

const client = PostgresClient.getClient();
const { handleApiErrors } = ValidateUtils;

function getRouterImpl(router) {
    const routerImpl = RouterResolver.getRouter(router);
    handleApiErrors([
        { condition: !routerImpl, message: `${router.name} no tiene implementación disponible`, status: 400 }
    ]);
    return routerImpl;
}
