import z from "zod";
import ValidateUtils from "../../utils/validate-utils.js";

const { ERROR_MESSAGES: { emptyString } } = ValidateUtils;
const invalidId = "UUID no válido";
const idSchema = z.object({
    id: z
        .uuid({ error: (issue) => (issue.input === undefined ? "Requerido" : invalidId) })
        .trim()
        .min(1, emptyString)
});

export default idSchema;
