import z from "zod";
import ValidateUtils from "../../utils/validate-utils.js";

const { ERROR_MESSAGES: { typeRequired, format } } = ValidateUtils;
const macSchema = z.object({ mac: z.string(typeRequired).trim().regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, format) });

export default macSchema;
