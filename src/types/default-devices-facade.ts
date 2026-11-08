import type { WebSocket } from "ws";
import type DevicesService from "../services/devices-service.js";
import type DevicesMapper from "../mappers/devices-mapper.js";
import type DataVersionsFacade from "../facades/data-versions-facade.js";
import type ConnectionsFacade from "../facades/connections-facade.js";
import type SocketSessionsFacade from "../facades/socket-sessions-facade.js";
import type RouterCpanel from "../utils/devices-routers/cpanel/router-cpanel.js";
import type RouterAutomation from "../utils/devices-routers/automation/router-automation.js";
import type { DevicesMapperDependencies } from "./default-devices-mapper.js";
import type { Device as DeviceModel } from "./devices-model.js";
import type { DeviceMapperSource } from "./devices-mapper.js";
import type { AddAllowParams, DeleteAllowParams } from "./router-automation.js";

export type DevicesFacadeDependencies<Transaction> = {
    devicesService: DevicesService<Transaction>;
    devicesMapper: DevicesMapper;
    dataVersionsFacade: DataVersionsFacade;
    connectionsFacade: ConnectionsFacade<Transaction>;
    routerAutomation: DevicesMapperDependencies["routerAutomation"];
    routerCpanel: RouterCpanel;
    socketSessionsFacade: SocketSessionsFacade<WebSocket>;
    tx: <Result>(callback: (clientTx: Transaction) => Result | Promise<Result>) => Promise<Result>;
};
export type RouterOperationParams = {
    key: string | null;
    addDevice: Omit<AddAllowParams, "key">;
    delDevice: Omit<DeleteAllowParams, "key">;
    routerImpl: RouterAutomation;
};
export type RouterOperation = (params: RouterOperationParams) => Promise<void>;
export type RouterRollbackParams = {
    key: string | null;
    addDevice: Omit<DeleteAllowParams, "key">;
    delDevice: Omit<AddAllowParams, "key">;
    routerImpl: RouterAutomation;
};
export type RouterRollback = (params: RouterRollbackParams) => Promise<void>;
export type UpdatedRouter = { routerImpl: RouterAutomation; updatedMacs: Omit<RouterOperationParams, "routerImpl">[] };
export type MapDeviceResult = { id: string; result: DeviceMapperSource };
export type MapDevicesResult = { id?: null; result: DeviceModel[] };
