import z from "zod";
import ZodUtils from "../../utils/zod-utils.js";

const {
    ERROR_MESSAGES: { emptyString }
} = ZodUtils;
const INVALID_ID = "UUID no válido";
const ID_SCHEMA = z.object({
    id: z
        .uuid({ error: (issue) => (issue.input === undefined ? "Requerido" : INVALID_ID) })
        .trim()
        .min(1, emptyString)
});

export default ID_SCHEMA;
