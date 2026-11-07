import type { RequestHandler } from "express";
import type WhitelistFacade from "../facades/whitelist-facade.js";
import type { DeviceId } from "./devices-model.js";
import type { AllowedDevice } from "./whitelist-facade.js";

export type WhitelistControllerDependencies = { whitelistFacade: WhitelistFacade };
export type WhitelistHandler = RequestHandler<DeviceId, AllowedDevice, AllowedDevice>;
export type WhitelistRequest = Parameters<WhitelistHandler>[0];
