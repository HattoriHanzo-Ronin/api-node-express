import type DevicesFacade from "../devices-facade.js";
import type {
    DevicesFacadeDependencies,
    MapDeviceResult,
    MapDevicesResult,
    RouterOperation,
    RouterRollback,
    UpdatedRouter
} from "../../types/devices/default-devices-facade.js";
import type {
    CloseDeviceRouterCpanelParams,
    CreateDeviceParams,
    CreateDeviceRouterCpanelParams,
    Device,
    NavigateDeviceRouterCpanelParams,
    UpdateDeviceFacadeParams
} from "../../types/devices/devices-facade.js";
import type { DeviceId, RouterIdParams } from "../../types/devices/devices-model.js";
import type { GetAllDevicesParams } from "../../types/devices/devices-service.js";
import type { ConnectionData } from "../../types/connections/connections-model.js";
import type { RouterAutomationPayload } from "../../types/utils/router-automation.js";
import ApiError from "../../utils/error/api-error.js";
import { DEVICE_TYPE, SOCKET_ENTITY } from "../../config/constants.js";
import { API_ERROR } from "../../config/errors.js";
import { LOG_EVENT } from "../../config/log-events.js";
import Logger from "../../utils/logger/logger.js";

const { deviceOperationCompleted, routerOperationFailed } = LOG_EVENT;

const { routerCpanelNotRouter, routerAddFailed, routerDeleteFailed, routerRollbackFailed } = API_ERROR;

/**
 * Default devices facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultDevicesFacade<Transaction> implements DevicesFacade {
    private static readonly LOGGER = Logger.getLogger(DefaultDevicesFacade);

    constructor(private readonly dependencies: DevicesFacadeDependencies<Transaction>) {}

    async getAll({}: GetAllDevicesParams = {}) {
        const [versionResult, result] = await Promise.all([
            this.dependencies.dataVersionsFacade.getById({ id: SOCKET_ENTITY.devices }),
            this.dependencies.devicesService.getAll({})
        ]);
        const { version } = versionResult;
        return { version, data: await this.mapResult({ result }) };
    }

    async getById({ id }: DeviceId) {
        const result = await this.dependencies.devicesService.getById({ id });
        return this.mapResult({ id, result });
    }

    async getAllowedDevices({ routerId }: RouterIdParams) {
        const [version, result] = await Promise.all([
            this.getVersions([SOCKET_ENTITY.devices, SOCKET_ENTITY.whitelist]),
            this.dependencies.devicesService.getAllowedDevices({ routerId })
        ]);
        const { devices, connections } = this.dependencies.devicesMapper.createDeviceSource(result);
        const connectionsByDevice = this.dependencies.connectionsFacade.connectionsByDeviceToDomain({
            source: connections
        });
        return { version, data: this.dependencies.devicesMapper.devicesToDomain({ devices, connectionsByDevice }) };
    }

    async getNotAllowedDevices({ routerId }: RouterIdParams) {
        const [version, result] = await Promise.all([
            this.getVersions([SOCKET_ENTITY.devices, SOCKET_ENTITY.whitelist]),
            this.dependencies.devicesService.getNotAllowedDevices({ routerId })
        ]);
        const { devices, connections } = this.dependencies.devicesMapper.createDeviceSource(result);
        const connectionsByDevice = this.dependencies.connectionsFacade.connectionsByDeviceToDomain({
            source: connections
        });
        return { version, data: this.dependencies.devicesMapper.devicesToDomain({ devices, connectionsByDevice }) };
    }

    async createRouterCpanel({ authUser, routerId, language, clientType, theme }: CreateDeviceRouterCpanelParams) {
        const router = await this.getById({ id: routerId });
        ApiError.handle([
            {
                condition: router.type !== DEVICE_TYPE.router,
                message: "El dispositivo no es un router",
                status: 400,
                apiError: routerCpanelNotRouter
            }
        ]);

        const { name, ip, admin_pass } = router;
        return this.dependencies.routerCpanel.create({
            ownerId: authUser.id,
            routerName: name,
            routerIp: ip!,
            routerPassword: admin_pass!,
            language,
            clientType,
            theme
        });
    }

    async navigateRouterCpanel({ authUser, sessionId, action }: NavigateDeviceRouterCpanelParams) {
        await this.dependencies.routerCpanel.navigate({ sessionId, ownerId: authUser.id, action });
    }

    async closeRouterCpanel({ authUser, sessionId }: CloseDeviceRouterCpanelParams) {
        await this.dependencies.routerCpanel.close({ sessionId, ownerId: authUser.id });
    }

    async create({ device }: CreateDeviceParams) {
        const result = await this.dependencies.tx(async (clientTx) => {
            const { connections, ...newDevice } = device;
            const result = await this.dependencies.devicesService.create({
                clientTx,
                device: newDevice
            });
            const deviceConnections = await this.dependencies.connectionsFacade.createMany({
                clientTx,
                deviceId: result.id,
                connections
            });
            return this.dependencies.devicesMapper.deviceToDomain({ source: result, connections: deviceConnections });
        });
        await this.dependencies.socketSessionsFacade.notify({
            entities: [SOCKET_ENTITY.devices, SOCKET_ENTITY.whitelist]
        });
        DefaultDevicesFacade.LOGGER.info({
            event: deviceOperationCompleted,
            message: "Device operation completed",
            context: `Device: ${result.id}, operation: create`
        });
        return result;
    }

    async update({ data }: UpdateDeviceFacadeParams) {
        const { id, connections, ...newData } = data;
        const { name: newDataName } = newData;
        const { connections: currentConnections, ...oldDevice } = await this.getById({
            id
        });
        let oldConnections = currentConnections;
        const { name: oldDeviceName } = oldDevice;
        const isNameUpdated = newDataName && newDataName !== oldDeviceName;
        const result = await this.dependencies.tx(async (clientTx) => {
            let device;
            const onlyUpdateConnections = Object.values(newData).every((value) => value === null) && connections;
            const result = onlyUpdateConnections
                ? oldDevice
                : await this.dependencies.devicesService.update({ clientTx, id, data: newData });
            const updateRouterWhitelist = async (connections: ConnectionData[]) => {
                const callback: RouterOperation = async ({ key, addDevice, delDevice, routerImpl }) => {
                    await routerImpl.delete({ key, ...delDevice });
                    await routerImpl.create({ key, ...addDevice });
                };
                const rollbackCallback: RouterRollback = async ({ key, addDevice, delDevice, routerImpl }) => {
                    await routerImpl.delete({ key, ...delDevice });
                    await routerImpl.create({ key, ...addDevice, name: oldDeviceName });
                };
                device = this.dependencies.devicesMapper.deviceToDomain({ source: result, connections });
                await this.executeRouterOperation(device, callback, rollbackCallback);
            };
            const excludeProcessedConnections = (connections: ConnectionData[]) =>
                oldConnections.filter(
                    ({ ctype }) => !connections.some(({ ctype: connectionCtype }) => ctype === connectionCtype)
                );
            if (connections) {
                const { deletedConnections, updatedConnections } = await this.dependencies.connectionsFacade.update({
                    clientTx,
                    deviceId: result.id,
                    connections,
                    oldConnections
                });
                if (deletedConnections) {
                    device = this.dependencies.devicesMapper.deviceToDomain({
                        source: result,
                        connections: deletedConnections
                    });
                    await this.deleteRouterWhitelist(device);
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
        await this.dependencies.socketSessionsFacade.notify({
            entities: [SOCKET_ENTITY.devices, SOCKET_ENTITY.whitelist]
        });
        DefaultDevicesFacade.LOGGER.info({
            event: deviceOperationCompleted,
            message: "Device operation completed",
            context: `Device: ${id}, operation: update`
        });
        return this.mapResult({ id, result });
    }

    async delete({ id }: DeviceId) {
        const device = await this.getById({ id });
        await this.deleteRouterWhitelist(device);
        const result = await this.dependencies.devicesService.delete({ id });
        await this.dependencies.socketSessionsFacade.notify({
            entities: [SOCKET_ENTITY.devices, SOCKET_ENTITY.whitelist]
        });
        DefaultDevicesFacade.LOGGER.info({
            event: deviceOperationCompleted,
            message: "Device operation completed",
            context: `Device: ${id}, operation: delete`
        });
        return result;
    }

    private async executeRouterOperation(
        { id, name, connections }: Device,
        callback: RouterOperation,
        rollbackCallback: RouterRollback
    ): Promise<void> {
        const source = await this.dependencies.devicesService.getRoutersByAllowedDevice({
            allowedDeviceId: id
        });
        const routers = this.dependencies.devicesMapper.routersToAutomation(source);
        const updatedRouters = new Map<string, UpdatedRouter>();
        let currentMac;
        for (const router of routers) {
            const { id: routerId, name: routerName, connections: oldConnections } = router;
            try {
                const routerImpl = new this.dependencies.routerAutomation({
                    router: router as RouterAutomationPayload
                });
                for (const { mac: oldMac, key, ctype } of oldConnections) {
                    const allowedDevice = connections.find(({ ctype: connectionCtype }) => connectionCtype === ctype);
                    if (allowedDevice) {
                        const addDevice = { mac: allowedDevice.mac, name };
                        const delDevice = { mac: oldMac };
                        currentMac = oldMac;
                        await callback({ key, addDevice, delDevice, routerImpl });
                        let updatedRouter = updatedRouters.get(routerName);
                        if (!updatedRouter) {
                            updatedRouter = { routerId, routerImpl, updatedMacs: [] };
                            updatedRouters.set(routerName, updatedRouter);
                        }

                        updatedRouter.updatedMacs.push({ key, addDevice, delDevice });
                    }
                }
            } catch (err) {
                DefaultDevicesFacade.LOGGER.warn({
                    event: routerOperationFailed,
                    message: "Router whitelist update failed during device operation",
                    context: `Router: ${routerId}, device: ${id}`
                });
                const restoredRouters: string[] = [];
                const addFailed = err instanceof ApiError && err.code === routerAddFailed;
                const apiError = err instanceof ApiError ? err.code : undefined;
                const affectedRouters = addFailed ? [routerName] : [];
                let message;
                for (const [
                    updatedRouterName,
                    { routerId: updatedRouterId, routerImpl, updatedMacs }
                ] of updatedRouters) {
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
                        DefaultDevicesFacade.LOGGER.warn({
                            event: LOG_EVENT.routerRollbackFailed,
                            message: "Router whitelist rollback failed",
                            context: `Router: ${updatedRouterId}, device: ${id}`
                        });
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
                                condition:
                                    err instanceof ApiError &&
                                    (err.code === routerAddFailed || err.code === routerDeleteFailed),
                                message,
                                apiError: routerRollbackFailed,
                                cause: err
                            }
                        ]);
                        throw err;
                    }
                }
                message =
                    `Error al actualizar la mac ${currentMac}, ha quedado eliminada de la lista en el router ${routerName}` +
                    ` debe restaurarla de forma manual`;
                ApiError.handle([{ condition: addFailed, message, apiError, cause: err }]);
                throw err;
            }
        }
    }

    private async deleteRouterWhitelist(device: Device): Promise<void> {
        const callback: RouterOperation = ({ key, delDevice, routerImpl }) => routerImpl.delete({ key, ...delDevice });
        const rollbackCallback: RouterRollback = async ({ key, addDevice, routerImpl }) => {
            await routerImpl.create({ key, ...addDevice, name: device.name });
        };
        await this.executeRouterOperation(device, callback, rollbackCallback);
    }

    private async getVersions(ids: string[]): Promise<Record<string, string>> {
        return this.dependencies.dataVersionsFacade.getById({ id: ids });
    }

    private async mapResult(params: MapDeviceResult): Promise<Device>;
    private async mapResult(params: MapDevicesResult): Promise<Device[]>;
    private async mapResult(params: MapDeviceResult | MapDevicesResult): Promise<Device | Device[]> {
        if (params.id !== undefined) {
            const { id, result } = params;
            const connections = await this.dependencies.connectionsFacade.getByDevices({ devicesId: [id] });
            return this.dependencies.devicesMapper.deviceToDomain({
                source: result,
                connections: connections.get(id) ?? []
            });
        }

        const { result } = params;
        if (result.length === 0) {
            return this.dependencies.devicesMapper.devicesToDomain({ devices: result, connectionsByDevice: new Map() });
        }

        const connections = await this.dependencies.connectionsFacade.getByDevices({
            devicesId: result.map(({ id }) => id)
        });
        return this.dependencies.devicesMapper.devicesToDomain({ devices: result, connectionsByDevice: connections });
    }
}
