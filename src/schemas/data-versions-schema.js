import z from "zod";
import { VALIDATION } from "../config/constants.js";

const { errorMessages, allowEnums } = VALIDATION;
const { typeRequired, invalidEnum } = errorMessages;
const { dataVersions } = allowEnums;
const entity = z.enum(dataVersions, invalidEnum(dataVersions));
const id = z
    .string(typeRequired)
    .transform((value) => value.split(",").map((it) => it.trim()))
    .pipe(z.array(entity).min(1));
const dataVersionsSchema = z.object({ id });

export { dataVersionsSchema };
