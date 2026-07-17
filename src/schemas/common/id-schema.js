import z from "zod";
import { VALIDATION } from "../../config/constants.js";

const { errorMessages } = VALIDATION;
const { invalidId, emptyString } = errorMessages;

const idSchema = z.object({
    id: z
        .uuid({ error: (issue) => (issue.input === undefined ? "Requerido" : invalidId) })
        .trim()
        .min(1, emptyString)
});

export default idSchema;
