import type RouterAutomation from "../utils/devices-routers/automation/router-automation.js";
import type { RouterAutomationPayload } from "./router-automation.js";

export type DevicesMapperDependencies = { routerAutomation: new (params: { router: RouterAutomationPayload }) => RouterAutomation };
