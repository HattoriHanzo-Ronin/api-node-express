import type { RequestHandler } from "express";
import type DevicesFacade from "../../facades/devices-facade.js";
import type { DeviceId } from "./devices-model.js";
import type {
    CreateDevice,
    CreateDeviceRouterCpanelParams,
    Device,
    NavigateDeviceRouterCpanelParams,
    UpdateDevice
} from "./devices-facade.js";
import type { RouterCpanelSession } from "../utils/router-cpanel.js";

export type DevicesControllerDependencies = { devicesFacade: DevicesFacade };
export type CreateDeviceInput = Pick<CreateDevice, "name" | "type" | "connections"> &
    Partial<Omit<CreateDevice, "name" | "type" | "connections">>;
export type DevicesHandler = RequestHandler<Record<string, never>, Device[]>;
export type DeviceHandler = RequestHandler<DeviceId, Device>;
export type RouterDevicesHandler = RequestHandler<DeviceId, Device[]>;
export type CreateDeviceHandler = RequestHandler<Record<string, never>, Device, CreateDeviceInput>;
export type UpdateDeviceHandler = RequestHandler<Record<string, never>, Device, UpdateDevice>;
export type DeleteDeviceHandler = RequestHandler<DeviceId, DeviceId | null>;
export type CreateCpanelHandler = RequestHandler<
    Pick<CreateDeviceRouterCpanelParams, "routerId">,
    RouterCpanelSession,
    Partial<Pick<CreateDeviceRouterCpanelParams, "language" | "clientType" | "theme">>
>;
export type NavigateCpanelHandler = RequestHandler<
    Pick<NavigateDeviceRouterCpanelParams, "sessionId">,
    void,
    Pick<NavigateDeviceRouterCpanelParams, "action">
>;
export type CloseCpanelHandler = RequestHandler<Pick<NavigateDeviceRouterCpanelParams, "sessionId">, void>;
export type RouterDevicesRequest = Parameters<RouterDevicesHandler>[0];
