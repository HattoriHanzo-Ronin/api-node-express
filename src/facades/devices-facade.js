import ApiError from "../utils/error/api-error.js";
import { DEVICE_TYPE } from "../config/constants.js";
import { API_ERROR } from "../config/errors.js";

/**
 * Devices facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesFacade {
    constructor({ devicesService, dataVersionsFacade, devicesMapper, connectionsFacade, routerAutomation, routerCpanel, tx }) {
        this.devicesService = devicesService;
        this.dataVersionsFacade = dataVersionsFacade;
        this.devicesMapper = devicesMapper;
        this.connectionsFacade = connectionsFacade;
        this.routerAutomation = routerAutomation;
        this.routerCpanel = routerCpanel;
        this.tx = tx;
    }

    /**
     * Returns all devices
     *
     * @returns {Promise<{ version: string, data: Object[] }>} Devices
     */
    async getAll() {
        const [{ version }, result] = await Promise.all([
            this.dataVersionsFacade.getById({ id: "devices" }),
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
        const { devices, connections } = this.devicesMapper.createDeviceSource(result);
        const connectionsByDevice = this.connectionsFacade.connectionsByDeviceToDomain({ source: connections });
        return { version, data: this.devicesMapper.devicesToDomain({ devices, connectionsByDevice }) };
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
        const { devices, connections } = this.devicesMapper.createDeviceSource(result);
        const connectionsByDevice = this.connectionsFacade.connectionsByDeviceToDomain({ source: connections });
        return { version, data: this.devicesMapper.devicesToDomain({ devices, connectionsByDevice }) };
    }

    /**
     * Creates a router control panel session
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.routerId Router identifier
     * @param {string | undefined} params.language Viewer language
     * @param {"desktop" | "mobile"} params.clientType Viewer client type
     * @param {"dark" | "light"} params.theme Viewer theme
     * @returns {Promise<{ id: string, url: string, expiresAt: string }>} Router control panel session
     */
    async createRouterCpanel({ authUser, routerId, language, clientType, theme }) {
        const router = await this.getById({ id: routerId });
        ApiError.handle([{
            condition: router.type !== DEVICE_TYPE.router,
            message: "El dispositivo no es un router",
            status: 400,
            apiError: routerCpanelNotRouter
        }]);

        return this.routerCpanel.create({
            ownerId: authUser.id,
            routerName: router.name,
            routerIp: router.ip,
            routerPassword: router.admin_pass,
            language,
            clientType,
            theme
        });
    }

    /**
     * Navigates a router control panel session
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.sessionId Router control panel session identifier
     * @param {"back" | "reload"} params.action Browser navigation action
     */
    async navigateRouterCpanel({ authUser, sessionId, action }) {
        await this.routerCpanel.navigate({ sessionId, ownerId: authUser.id, action });
    }

    /**
     * Deletes a router control panel session
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string} params.sessionId Router control panel session identifier
     */
    async closeRouterCpanel({ authUser, sessionId }) {
        await this.routerCpanel.close({ sessionId, ownerId: authUser.id });
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
            const deviceConnections = await this.connectionsFacade.createMany({
                clientTx,
                deviceId: result.id,
                connections
            });
            return this.devicesMapper.deviceToDomain({ source: result, connections: deviceConnections });
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
        const { connections: currentConnections, ...oldDevice } = await this.getById({
            id
        });
        let oldConnections = currentConnections;
        const { name: oldDeviceName } = oldDevice;
        const isNameUpdated = newDataName && newDataName !== oldDeviceName;
        const result = await this.tx(async (clientTx) => {
            let device;
            const onlyUpdateConnections = Object.values(newData).every((value) => value === null) && connections;
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
                device = this.devicesMapper.deviceToDomain({ source: result, connections });
                await this.#executeRouterOperation(device, callback, rollbackCallback);
            };
            const excludeProcessedConnections = (connections) =>
                oldConnections.filter(
                    ({ ctype }) => !connections.some(({ ctype: connectionCtype }) => ctype === connectionCtype)
                );
            if (connections) {
                const { deletedConnections, updatedConnections } = await this.connectionsFacade.update({
                    clientTx,
                    deviceId: result.id,
                    connections,
                    oldConnections
                });
                if (deletedConnections) {
                    device = this.devicesMapper.deviceToDomain({ source: result, connections: deletedConnections });
                    await this.#deleteRouterWhitelist(device);
                    oldConnections = excludeProcessedConnections(deletedConnections);
                }

                if (updatedConnections) {
                    await updateRouterWhitelist(updatedConnections);
                    oldConnections = excludeProcessedConnections(updatedConnections);
                }
            }

            if (isNameUpdated) {
                await updateRouterWhitelist(oldConnections.map((connection) => ({ device_id: id, ...connection })));
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
        const source = await this.devicesService.getRoutersByAllowedDevice({
            allowedDeviceId: id
        });
        const routers = this.devicesMapper.routersToAutomation(source);
        const updatedRouters = new Map();
        let currentMac;
        for (const router of routers) {
            const { name: routerName, connections: oldConnections } = router;
            try {
                const routerImpl = new this.routerAutomation({ router });
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
                const addFailed = errorCode === routerAddFailed;
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
                        ApiError.handle([
                            {
                                condition: [routerAddFailed, routerDeleteFailed].includes(err.code),
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
                ApiError.handle([{ condition: addFailed, message, apiError }]);
                throw err;
            }
        }
    }

    async #deleteRouterWhitelist(device) {
        const callback = ({ key, delDevice, routerImpl }) => routerImpl.delete({ key, ...delDevice });
        const rollbackCallback = async ({ key, addDevice, routerImpl }) => {
            await routerImpl.create({ key, ...addDevice, name: device.name });
        };
        await this.#executeRouterOperation(device, callback, rollbackCallback);
    }

    async #getVersions(ids) {
        return this.dataVersionsFacade.getById({ id: ids });
    }

    async #mapResult({ id = null, result }) {
        let connections;
        if (id) {
            connections = await this.connectionsFacade.getByDevices({
                devicesId: [id]
            });
            return this.devicesMapper.deviceToDomain({ source: result, connections: connections.get(id) ?? [] });
        }

        if (result.length === 0) {
            return this.devicesMapper.devicesToDomain({
                devices: result,
                connectionsByDevice: new Map()
            });
        }

        connections = await this.connectionsFacade.getByDevices({
            devicesId: result.map(({ id }) => id)
        });
        return this.devicesMapper.devicesToDomain({ devices: result, connectionsByDevice: connections });
    }
}

const { routerCpanelNotRouter, routerAddFailed, routerDeleteFailed, routerRollbackFailed } = API_ERROR;
