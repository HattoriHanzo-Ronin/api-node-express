import z from "zod";
import ValidateUtils from "../utils/validate-utils.js";

const { ERROR_MESSAGES, ALLOW_ENUMS } = ValidateUtils;
const { typeRequired, invalidEnum } = ERROR_MESSAGES;
const { dataVersions } = ALLOW_ENUMS;
const entity = z.enum(dataVersions, invalidEnum(dataVersions));
const id = z
    .string(typeRequired)
    .transform((value) => value.split(",").map((it) => it.trim()))
    .pipe(z.array(entity).min(1));
const dataVersionsSchema = z.object({ id });

export { dataVersionsSchema };
