import z from "zod";
import ValidateUtils from "../utils/validate-utils.js";
import dirSchema from "./common/dir-schema.js";

const { ERROR_MESSAGES: { typeRequired, invalidEnum } } = ValidateUtils;
const DATA_VERSION = Object.freeze({ devices: "devices", whitelist: "whitelist", users: "users", ftp: "ftp" });
const DATA_VERSIONS = Object.values(DATA_VERSION);
const ENTITY = z.enum(DATA_VERSIONS, invalidEnum(DATA_VERSIONS));
const dataVersionsSchema = z.object({ entities: z.array(ENTITY, typeRequired).min(1), dir: dirSchema.shape.dir });

export { dataVersionsSchema };
