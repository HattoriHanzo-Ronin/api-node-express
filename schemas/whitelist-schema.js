import z from "zod";
import ValidateUtils from "../utils/validate-utils.js";
import idSchema from "./id-schema.js";
import DevicesSchema from "./devices-schema.js";

const { ERROR_MESSAGES, REGEX } = ValidateUtils;
const { typeRequired, format, length } = ERROR_MESSAGES;
const { passwordRegex, ipRegex, safeTextRegex } = REGEX;
const { name, mac } = DevicesSchema.getDevicesSchema().shape;
const allowedDeviceSchema = z.object({
    id: idSchema.shape.id,
    name,
    mac
});
const routerSchema = allowedDeviceSchema.extend({
    model: z
        .string(typeRequired)
        .trim()
        .min(8, length(8, "min"))
        .max(60, length(60, "max"))
        .regex(safeTextRegex, format),
    ip: z.string(typeRequired).trim().regex(ipRegex, format),
    admin_pass: z
        .string(typeRequired)
        .trim()
        .min(8, length(8, "min"))
        .max(128, length(128, "max"))
        .regex(passwordRegex, format),
    mac_filter: z.literal(true, { error: "El router debe soportar filtro mac" })
});

export { allowedDeviceSchema, routerSchema };
