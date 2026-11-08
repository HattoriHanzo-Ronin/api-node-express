import type { ConnectionData } from "../connections/connections-model.js";
import type { CreateDevice, UpdateDevice } from "./devices-facade.js";
import type { Device } from "./devices-model.js";

export type DeviceSchemaData = CreateDevice | UpdateDevice | (Device & { connections?: ConnectionData[] });
