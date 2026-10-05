import z from "zod";
import ValidateUtils from "../../utils/validate-utils.js";

const { ERROR_MESSAGES } = ValidateUtils;
const { typeRequired, format } = ERROR_MESSAGES;
const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const macSchema = z.object({ mac: z.string(typeRequired).trim().regex(macRegex, format) });

export default macSchema;
