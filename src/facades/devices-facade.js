import ValidateUtils from "../utils/validate-utils.js";
import RouterResolver from "../devices-routers/router-resolver.js";
import { API_ERROR } from "../config/constants.js";

/**
 * Devices facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesFacade {
    constructor({ devicesService, dataVersionsService, devicesMapper, connectionsService, tx }) {
        this.devicesService = devicesService;
        this.dataVersionsService = dataVersionsService;
        this.devicesMapper = devicesMapper;
        this.connectionsService = connectionsService;
        this.tx = tx;
    }

    /**
     * Returns all devices
     *
     * @returns {Promise<{ version: string, data: Object[] }>} Devices
     */
    async getAll() {
        const [{ version }, result] = await Promise.all([
            this.dataVersionsService.getById({ id: "devices" }),
            this.devicesService.getAll()
        ]);
        return { version, data: await this.#mapResult({ result }) };
    }

    /**
     * Returns a device by its identifier
     *
     * @param {string} params.id Device identifier
     * @returns {Promise<Object>} Device
     */
    async getById({ id }) {
        const result = await this.devicesService.getById({ id });
        return this.#mapResult({ id, result });
    }

    /**
     * Returns the devices allowed on a router
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<{ version: Object, data: Object[] }>} Allowed devices
     */
    async getAllowedDevices({ routerId }) {
        const [version, result] = await Promise.all([
            this.#getVersions(["devices", "whitelist"]),
            this.devicesService.getAllowedDevices({ routerId })
        ]);
        const source = this.devicesMapper.createDeviceSource(result);
        return { version, data: this.devicesMapper.devicesToDomain(source) };
    }

    /**
     * Returns the devices not allowed on a router
     *
     * @param {string} params.routerId Router identifier
     * @returns {Promise<{ version: Object, data: Object[] }>} Devices not allowed on the router
     */
    async getNotAllowedDevices({ routerId }) {
        const [version, result] = await Promise.all([
            this.#getVersions(["devices", "whitelist"]),
            this.devicesService.getNotAllowedDevices({ routerId })
        ]);
        const source = this.devicesMapper.createDeviceSource(result);
        return { version, data: this.devicesMapper.devicesToDomain(source) };
    }

    /**
     * Creates a device
     *
     * @param {Object} params.device Device data
     * @returns {Promise<Object>} Created device
     */
    async create({ device }) {
        return this.tx(async (clientTx) => {
            const { connections, ...newDevice } = device;
            const result = await this.devicesService.create({
                clientTx,
                device: newDevice
            });
            const deviceConnections = await this.connectionsService.createMany({
                clientTx,
                deviceId: result.id,
                connections
            });
            return this.devicesMapper.deviceToDomain({
                ...result,
                connections: deviceConnections
            });
        });
    }

    /**
     * Updates a device
     *
     * @param {Object} params.data Device data
     * @returns {Promise<Object>} Updated device
     */
    async update({ data }) {
        const { id, connections, ...newData } = data;
        const { name: newDataName } = newData;
        let { connections: oldConnections, ...oldDevice } = await this.getById({
            id
        });
        const { name: oldDeviceName } = oldDevice;
        const isNameUpdated = newDataName && newDataName !== oldDeviceName;
        const result = await this.tx(async (clientTx) => {
            let device;
            const onlyUpdateConnections = Object.values(newData).every((it) => it === null) && connections;
            const result = onlyUpdateConnections
                ? oldDevice
                : await this.devicesService.update({ clientTx, id, data: newData });
            const updateRouterWhitelist = async (connections) => {
                const callback = async ({ key, addDevice, delDevice, routerImpl }) => {
                    await routerImpl.delete({ key, ...delDevice });
                    await routerImpl.create({ key, ...addDevice });
                };
                const rollbackCallback = async ({ key, addDevice, delDevice, routerImpl }) => {
                    await routerImpl.delete({ key, ...delDevice });
                    await routerImpl.create({ key, ...addDevice, name: oldDeviceName });
                };
                device = this.devicesMapper.deviceToDomain({ ...result, connections });
                await this.#executeRouterOperation(device, callback, rollbackCallback);
            };
            const excludeProcessedConnections = (connections) =>
                oldConnections.filter(
                    ({ ctype }) => !connections.some(({ ctype: connectionCtype }) => ctype === connectionCtype)
                );
            if (connections) {
                const { deletedConnections, updatedConnections } = await this.connectionsService.update({
                    clientTx,
                    deviceId: result.id,
                    connections,
                    oldConnections
                });
                if (deletedConnections) {
                    device = this.devicesMapper.deviceToDomain({
                        ...result,
                        connections: deletedConnections
                    });
                    await this.#deleteRouterWhitelist(device);
                    oldConnections = excludeProcessedConnections(deletedConnections);
                }

                if (updatedConnections) {
                    await updateRouterWhitelist(updatedConnections);
                    oldConnections = excludeProcessedConnections(updatedConnections);
                }
            }

            if (isNameUpdated) {
                await updateRouterWhitelist(oldConnections.map((it) => ({ device_id: id, ...it })));
            }

            return result;
        });
        return this.#mapResult({ id, result });
    }

    /**
     * Deletes a device
     *
     * @param {string} params.id Device identifier
     * @returns {Promise<{ id: string }>} Deleted device identifier
     */
    async delete({ id }) {
        const device = await this.getById({ id });
        await this.#deleteRouterWhitelist(device);
        return this.devicesService.delete({ id });
    }

    /**
     * Executes a router operation and restores the previous state if any router fails
     *
     * @param {{ id: string, name: string, connections: Object[] }} device Allowed device
     * @param {Function} callback Router operation
     * @param {Function} rollbackCallback Rollback operation
     */
    async #executeRouterOperation({ id, name, connections }, callback, rollbackCallback) {
        const routers = await this.devicesService.getRoutersByAllowedDevice({
            allowedDeviceId: id
        });
        const updatedRouters = new Map();
        let currentMac;
        for (const router of routers) {
            const { name: routerName, connections: oldConnections } = router;
            try {
                const routerImpl = new RouterResolver(router);
                for (const { mac: oldMac, key, ctype } of oldConnections) {
                    const allowedDevice = connections.find(({ ctype: connectionCtype }) => connectionCtype === ctype);
                    if (allowedDevice) {
                        const addDevice = { mac: allowedDevice.mac, name };
                        const delDevice = { mac: oldMac };
                        currentMac = oldMac;
                        await callback({ key, addDevice, delDevice, routerImpl });
                        let updatedRouter = updatedRouters.get(routerName);
                        if (!updatedRouter) {
                            updatedRouter = { routerImpl, updatedMacs: [] };
                            updatedRouters.set(routerName, updatedRouter);
                        }

                        updatedRouter.updatedMacs.push({ key, addDevice, delDevice });
                    }
                }
            } catch (err) {
                const restoredRouters = [];
                const { code: errorCode, apiError } = err;
                const addFailed = errorCode === routerAddFailed.code;
                const affectedRouters = addFailed ? [routerName] : [];
                let message;
                for (const updatedRouterName of updatedRouters.keys()) {
                    const { routerImpl, updatedMacs } = updatedRouters.get(updatedRouterName);
                    let currentUpdatedMac;
                    try {
                        for (const { key, addDevice, delDevice } of updatedMacs) {
                            currentUpdatedMac = delDevice.mac;
                            await rollbackCallback({
                                key,
                                addDevice: delDevice,
                                delDevice: addDevice,
                                routerImpl
                            });
                        }
                        restoredRouters.push(updatedRouterName);
                    } catch (err) {
                        updatedRouters.forEach((_, key) => {
                            if (!restoredRouters.includes(key) && key !== updatedRouterName) {
                                affectedRouters.push(key);
                            }
                        });
                        message =
                            `Error al tratar de recuperar la mac ${currentUpdatedMac} en el router ${updatedRouterName}\n` +
                            `Routers afectados: ${affectedRouters.join(", ")}`;
                        handleApiErrors([
                            {
                                condition: [routerAddFailed.code, routerDeleteFailed.code].includes(err.code),
                                message,
                                apiError: routerRollbackFailed
                            }
                        ]);
                        throw err;
                    }
                }
                message =
                    `Error al actualizar la mac ${currentMac}, ha quedado eliminada de la lista en el router ${routerName}` +
                    ` debe restaurarla de forma manual`;
                handleApiErrors([{ condition: addFailed, message, apiError }]);
                throw err;
            }
        }
    }

    async #deleteRouterWhitelist(device) {
        const callback = async ({ key, delDevice, routerImpl }) => await routerImpl.delete({ key, ...delDevice });
        const rollbackCallback = async ({ key, addDevice, routerImpl }) => {
            await routerImpl.create({ key, ...addDevice, name: device.name });
        };
        await this.#executeRouterOperation(device, callback, rollbackCallback);
    }

    async #getVersions(ids) {
        const dataVersions = await Promise.all(ids.map((id) => this.dataVersionsService.getById({ id })));
        return Object.fromEntries(ids.map((id, index) => [id, dataVersions[index].version]));
    }

    async #mapResult({ id = null, result }) {
        let connections;
        if (id) {
            connections = await this.connectionsService.getByDevices({
                devicesId: [id]
            });
            return this.devicesMapper.deviceToDomain({ ...result, connections });
        }

        if (result.length === 0) {
            return this.devicesMapper.devicesToDomain({
                devices: result,
                connections: []
            });
        }

        connections = await this.connectionsService.getByDevices({
            devicesId: result.map(({ id }) => id)
        });
        return this.devicesMapper.devicesToDomain({ devices: result, connections });
    }
}

const { handleApiErrors } = ValidateUtils;
const { routerAddFailed, routerDeleteFailed, routerRollbackFailed } = API_ERROR;
