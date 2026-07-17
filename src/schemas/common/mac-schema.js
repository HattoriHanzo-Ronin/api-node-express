import z from "zod";
import { VALIDATION } from "../../config/constants.js";

const { regex, errorMessages } = VALIDATION;
const { typeRequired, format } = errorMessages;
const macSchema = z.object({ mac: z.string(typeRequired).trim().regex(regex.macRegex, format) });

export default macSchema;
