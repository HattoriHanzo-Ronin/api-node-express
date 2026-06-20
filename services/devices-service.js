import PostgresClient from "../config/db/postgres-client.js";
import RouterResolver from "../devices-routers/router-resolver.js";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * Devices service
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesService {
    constructor({ devicesModel, whitelistService }) {
        this.devicesModel = devicesModel;
        this.whitelistService = whitelistService;
    }

    /**
     * Retrieves all devices
     *
     * @returns {Promise<Object[]>} List of devices
     */
    async getAll() {
        const devices = await this.devicesModel.getAll();
        return addCapabilities(devices);
    }

    /**
     * Retrieves a device by identifier
     *
     * @param {string} params.id Device identifier
     * @returns {Promise<Object>} Device
     */
    async getById({ id }) {
        const result = await this.devicesModel.getById({ id });
        handleApiErrors([{ condition: !result, message: "El dispositivo no existe", status: 404 }]);
        return addCapabilities([result])[0];
    }

    /**
     * Retrieves allowed devices for a router
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<Object[]>} List of allowed devices
     */
    async getAllowDevices({ routerId }) {
        const devices = await this.devicesModel.getAllowedDevices({ routerId });
        return addCapabilities(devices);
    }

    /**
     * Retrieves devices not allowed on a router
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<Object[]>} List of devices not allowed on the router
     */
    async getNotAllowDevices({ routerId }) {
        const devices = await this.devicesModel.getNotAllowedDevices({ routerId });
        return addCapabilities(devices);
    }

    /**
     * Creates a device
     *
     * @param {Object} params.device Device data
     * @returns {Promise<{ id: string }>} Created device identifier
     */
    async create({ device }) {
        try {
            return await this.devicesModel.insert({ device });
        } catch (err) {
            handleApiErrors([{ condition: err.code === "23505", message: "El dispositivo ya existe" }]);
            throw err;
        }
    }

    /**
     * Updates a device
     *
     * @param {Object} params.data Device data
     * @returns {Promise<{ id: string }>} Updated device identifier
     */
    async update({ data }) {
        const { id, ...updateData } = data;
        const oldDevice = await this.getById({ id });
        return client.tx(async (clientTx) => {
            const result = await this.devicesModel.update({ clientTx, id, data: updateData });
            if (updateData.name || updateData.mac) {
                const routers = await this.devicesModel.getRoutersByAllowDevice({ allowDeviceId: id });
                const updatedRouters = [];
                for (const router of routers) {
                    try {
                        await this.whitelistService.delete({ router, allowDevice: oldDevice });
                        await this.whitelistService.create({ router, allowDevice: result });
                    } catch (err) {
                        for (const updatedRouter of updatedRouters.reverse()) {
                            await this.whitelistService.delete({ router: updatedRouter, allowDevice: result });
                            await this.whitelistService.create({ router: updatedRouter, allowDevice: oldDevice });
                        }
                        handleApiErrors([
                            {
                                condition: err?.message === "Error al insertar el dispositivo en el router",
                                message: `Error al actualizar el dispositivo ${result.name} en el router ${router.name}, el dispositivo a quedado eliminado debe restaurarlo de forma manual`
                            }
                        ]);
                        throw err;
                    }
                    updatedRouters.push(router);
                }
            }

            const { mac: _, name: __, ...response } = result;
            return response;
        });
    }

    /**
     * Deletes a device
     *
     * @param {string} params.id Device identifier
     * @returns {Promise<{ id: string }>} Deleted device identifier
     */
    async delete({ id }) {
        const device = await this.getById({ id });
        const routers = await this.devicesModel.getRoutersByAllowDevice({ allowDeviceId: id });
        const updatedRouters = [];
        for (const router of routers) {
            try {
                await this.whitelistService.delete({ router, allowDevice: device });
            } catch (err) {
                for (const updatedRouter of updatedRouters.reverse()) {
                    await this.whitelistService.create({ router: updatedRouter, allowDevice: device });
                }
                throw err;
            }
            updatedRouters.push(router);
        }
        return this.devicesModel.delete({ id });
    }
}

const { ALLOW_ENUMS, ERROR_MESSAGES, handleApiErrors } = ValidateUtils;
const client = PostgresClient.getClient();

function addCapabilities(devices) {
    return devices.map((device) => {
        if (device.type === "ROUTER") {
            const routerImpl = RouterResolver.getRouter(device);
            if (routerImpl) {
                return { ...device, capabilities: routerImpl.getCapabilities() };
            }
        }

        return device;
    });
}
