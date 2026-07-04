import z from "zod";
import ValidateUtils from "../utils/validate-utils.js";

const { REGEX, ERROR_MESSAGES } = ValidateUtils;
const { typeRequired, format } = ERROR_MESSAGES;
const macSchema = z.object({ mac: z.string(typeRequired).trim().regex(REGEX.macRegex, format) });

export default macSchema;
