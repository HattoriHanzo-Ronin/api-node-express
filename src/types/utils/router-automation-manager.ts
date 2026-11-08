import type AbstractRouter from "../../utils/devices-routers/automation/routers/abstract-router.js";
import type { RouterAutomationPayload } from "./router-automation.js";

export type RouterAutomationImplementation = new (params: { router: RouterAutomationPayload }) => AbstractRouter;

export type RouterAutomationImplementations = Readonly<Record<string, RouterAutomationImplementation>>;
