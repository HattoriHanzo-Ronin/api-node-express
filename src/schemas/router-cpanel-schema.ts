import z from "zod";
import { ROUTER_CPANEL_ACTION, ROUTER_CPANEL_CLIENT_TYPE, ROUTER_CPANEL_THEME } from "../config/constants.js";
import ZodUtils from "../utils/zod-utils.js";

const {
    ERROR_MESSAGES: { typeRequired, typeNotRequired, format, length }
} = ZodUtils;
const ROUTER_CPANEL_SESSION_SCHEMA = z.object({
    clientType: z.enum(Object.values(ROUTER_CPANEL_CLIENT_TYPE), typeRequired).optional().default("desktop"),
    theme: z.enum(Object.values(ROUTER_CPANEL_THEME), typeRequired).optional().default("dark"),
    language: z
        .string(typeNotRequired)
        .trim()
        .min(2, length(2, "min"))
        .max(5, length(5, "max"))
        .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/, format)
        .optional()
});
const ROUTER_CPANEL_NAVIGATION_SCHEMA = z.object({ action: z.enum(Object.values(ROUTER_CPANEL_ACTION), typeRequired) });

export { ROUTER_CPANEL_SESSION_SCHEMA, ROUTER_CPANEL_NAVIGATION_SCHEMA };
