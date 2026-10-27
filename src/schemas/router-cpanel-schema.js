import z from "zod";
import ValidateUtils from "../utils/validate-utils.js";

const {
    ERROR_MESSAGES: { typeRequired, typeNotRequired, format, length }
} = ValidateUtils;
const ROUTER_CPANEL_ACTIONS = Object.freeze({ back: "back", reload: "reload" });
const ROUTER_CPANEL_CLIENT_TYPES = Object.freeze({ desktop: "desktop", mobile: "mobile" });
const ROUTER_CPANEL_THEMES = Object.freeze({ dark: "dark", light: "light" });
const routerCpanelSessionSchema = z.object({
    clientType: z.enum(Object.values(ROUTER_CPANEL_CLIENT_TYPES), typeRequired).optional().default("desktop"),
    theme: z.enum(Object.values(ROUTER_CPANEL_THEMES), typeRequired).optional().default("dark"),
    language: z
        .string(typeNotRequired)
        .trim()
        .min(2, length(2, "min"))
        .max(5, length(5, "max"))
        .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/, format)
        .optional()
});
const routerCpanelNavigationSchema = z.object({ action: z.enum(Object.values(ROUTER_CPANEL_ACTIONS), typeRequired) });

export { routerCpanelSessionSchema, routerCpanelNavigationSchema };
