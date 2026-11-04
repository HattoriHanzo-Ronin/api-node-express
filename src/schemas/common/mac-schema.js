import z from "zod";
import ZodUtils from "../../utils/zod-utils.js";

const {
    ERROR_MESSAGES: { typeRequired, format }
} = ZodUtils;
const macSchema = z.object({
    mac: z
        .string(typeRequired)
        .trim()
        .regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, format)
});

export default macSchema;
