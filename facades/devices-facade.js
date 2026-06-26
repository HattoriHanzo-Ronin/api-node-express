import ValidateUtils from "../utils/validate-utils.js";
import RouterResolver from "../devices-routers/router-resolver.js";

/**
 * Devices facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesFacade {
    constructor({ devicesService, devicesMapper, tx }) {
        this.devicesService = devicesService;
        this.devicesMapper = devicesMapper;
        this.tx = tx;
    }

    /**
     * Retrieves all devices
     *
     * @returns {Promise<Object[]>} Devices
     */
    async getAll() {
        const result = await this.devicesService.getAll();
        return this.devicesMapper.devicesToDomain(result);
    }

    /**
     * Retrieves a device by its identifier
     *
     * @param {string} params.id Device identifier
     * @returns {Promise<Object>} Device
     */
    async getById({ id }) {
        const result = await this.devicesService.getById({ id });
        return this.devicesMapper.deviceToDomain(result);
    }

    /**
     * Retrieves devices allowed by a router
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<Object[]>} List of allowed devices
     */
    async getAllowedDevices({ routerId }) {
        const result = await this.devicesService.getAllowedDevices({ routerId });
        return this.devicesMapper.devicesToDomain(result);
    }

    /**
     * Retrieves devices not allowed by a router
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<Object[]>} List of not allowed devices
     */
    async getNotAllowedDevices({ routerId }) {
        const result = await this.devicesService.getNotAllowedDevices({ routerId });
        return this.devicesMapper.devicesToDomain(result);
    }

    /**
     * Creates a device
     *
     * @param {Object} params.device Device data
     * @returns {Promise<Object>} Created device
     */
    async create({ device }) {
        const result = await this.devicesService.create({ device });
        return this.devicesMapper.deviceToDomain(result);
    }

    /**
     * Updates a device and synchronizes the changes with the corresponding routers
     *
     * @param {Object} params.data Device data
     * @returns {Promise<Object>} Updated device
     */
    async update({ data }) {
        const { id, ...newData } = data;
        const oldDevice = await this.devicesService.getById({ id });
        const { name: newDataName, mac: newDataMac } = newData;
        const isNameUpdated = newDataName && newDataName !== oldDevice.name;
        const isMacUpdated = newDataMac && newDataMac !== oldDevice.mac;
        return this.tx(async (clientTx) => {
            const result = await this.devicesService.update({ clientTx, id, data: newData });
            if (isNameUpdated || isMacUpdated) {
                const callback = async (key, routerImpl) => {
                    await routerImpl.delete({ key, ...oldDevice });
                    await routerImpl.create({ key, ...result });
                };
                const rollbackCallback = async (key, routerImpl) => {
                    await routerImpl.delete({ key, ...result });
                    await routerImpl.create({ key, ...oldDevice });
                };
                await this.#executeRouterOperation(result, callback, rollbackCallback);
            }

            return this.devicesMapper.deviceToDomain(result);
        });
    }

    /**
     * Deletes a device and removes it from all associated routers
     *
     * @param {string} params.id Device identifier
     * @returns {Promise<{ id: string }>} Deleted device identifier
     */
    async delete({ id }) {
        const device = await this.getById({ id });
        const callback = async (key, routerImpl) => await routerImpl.delete({ key, ...device });
        const rollbackCallback = async (key, routerImpl) => await routerImpl.create({ key, ...device });
        await this.#executeRouterOperation(device, callback, rollbackCallback);
        return this.devicesService.delete({ id });
    }

    /**
     * Executes a router operation
     *
     * @param {{ id: string, name: string }} device Allowed device data
     * @param {(key: string | null, router: RouterResolver) => Promise<void>} callback Router operation
     * @param {(key: string | null, router: RouterResolver) => Promise<void>} rollbackCallback Rollback operation
     */
    async #executeRouterOperation({ id, name }, callback, rollbackCallback) {
        const routers = await this.devicesService.getRoutersByAllowedDevice({ allowedDeviceId: id });
        let routerImpl;
        const updatedRouters = [];
        for (const router of routers) {
            const { name: routerName, key } = router;
            try {
                routerImpl = new RouterResolver(router);
                await callback(key, routerImpl);
                updatedRouters.push(router);
            } catch (err) {
                const restoredRouters = [];
                const { code: errorCode } = err;
                const addFailed = errorCode === "ROUTER_ADD_FAILED";
                const affectedRouters = addFailed ? [routerName] : [];
                let message;
                for (const updatedRouter of [...updatedRouters].reverse()) {
                    const { name: updatedRouterName, key } = updatedRouter;
                    try {
                        routerImpl = new RouterResolver(updatedRouter);
                        await rollbackCallback(key, routerImpl);
                        restoredRouters.push(updatedRouterName);
                    } catch (err) {
                        affectedRouters.push(
                            ...updatedRouters
                                .filter(({ name }) => !restoredRouters.includes(name) && name !== updatedRouterName)
                                .map((it) => it.name)
                        );
                        message =
                            `Error al tratar de recuperar el dispositivo ${name} en el router ${updatedRouterName}\n` +
                            `Routers afectados: ${affectedRouters.join(", ")}`;
                        handleApiErrors([
                            {
                                condition: ["ROUTER_ADD_FAILED", "ROUTER_DELETE_FAILED"].includes(err.code),
                                message,
                                code: "ROUTER_ROLLBACK_FAILED"
                            }
                        ]);
                        throw err;
                    }
                }
                message =
                    `Error al actualizar el dispositivo en el router ${routerName}, el dispositivo ${name}` +
                    ` ha quedado eliminado de la lista debe restaurarlo de forma manual`;
                handleApiErrors([{ condition: addFailed, message, code: errorCode }]);
                throw err;
            }
        }
    }
}

const { handleApiErrors } = ValidateUtils;
