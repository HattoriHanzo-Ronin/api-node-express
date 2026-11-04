import z from "zod";
import ZodUtils from "../../utils/zod-utils.js";

const {
    ERROR_MESSAGES: { emptyString }
} = ZodUtils;
const invalidId = "UUID no válido";
const idSchema = z.object({
    id: z
        .uuid({ error: (issue) => (issue.input === undefined ? "Requerido" : invalidId) })
        .trim()
        .min(1, emptyString)
});

export default idSchema;
