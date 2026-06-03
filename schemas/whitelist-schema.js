import z from "zod";
import ValidateUtils from "../utils/validate-utils.js";

const { ERROR_MESSAGES, REGEX } = ValidateUtils;
const { typeRequired, format, length, invalidId } = ERROR_MESSAGES;
const { passwordRegex, macRegex, ipRegex, safeTextRegex } = REGEX;
const allowDeviceSchema = z.object({
    id: z.string(typeRequired).uuid(invalidId),
    name: z
        .string(typeRequired)
        .trim()
        .min(4, length(4, "min"))
        .max(30, length(30, "max"))
        .regex(safeTextRegex, format),
    mac: z.string(typeRequired).trim().regex(macRegex, format)
});
const routerSchema = allowDeviceSchema.extend({
    model: z.string(typeRequired).trim().min(8, length(8, "min")).max(60, length(60, "max")).regex(safeTextRegex, format),
    ip: z.string(typeRequired).trim().regex(ipRegex, format),
    admin_pass: z
        .string(typeRequired)
        .trim()
        .min(8, length(8, "min"))
        .max(128, length(128, "max"))
        .regex(passwordRegex, format),
    mac_filter: z.literal(true, { error: "El router debe soportar filtro mac" })
});

export { allowDeviceSchema, routerSchema };
