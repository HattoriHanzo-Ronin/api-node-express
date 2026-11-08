import type { WebSocket } from "ws";
import type WhitelistService from "../services/whitelist-service.js";
import type DevicesFacade from "../facades/devices-facade.js";
import type DataVersionsFacade from "../facades/data-versions-facade.js";
import type SocketSessionsFacade from "../facades/socket-sessions-facade.js";
import type { DevicesFacadeDependencies } from "./default-devices-facade.js";

export type WhitelistFacadeDependencies<Transaction> = {
    whitelistService: WhitelistService<Transaction>;
    dataVersionsFacade: DataVersionsFacade;
    devicesFacade: DevicesFacade;
    routerAutomation: DevicesFacadeDependencies<Transaction>["routerAutomation"];
    socketSessionsFacade: SocketSessionsFacade<WebSocket>;
    tx: DevicesFacadeDependencies<Transaction>["tx"];
};
