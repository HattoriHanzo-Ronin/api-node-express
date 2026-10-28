import z from "zod";
import ValidateUtils from "../utils/validate-utils.js";

const { ERROR_MESSAGES: { typeRequired, invalidEnum } } = ValidateUtils;
const DATA_VERSION = Object.freeze({ devices: "devices", whitelist: "whitelist", users: "users" });
const dataVersions = Object.values(DATA_VERSION);
const entity = z.enum(dataVersions, invalidEnum(dataVersions));
const id = z
    .string(typeRequired)
    .transform((value) => value.split(",").map((item) => item.trim()))
    .pipe(z.array(entity).min(1));
const dataVersionsSchema = z.object({ id });

export { dataVersionsSchema };
