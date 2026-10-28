import z from "zod";
import path from "node:path";
import ValidateUtils from "../../utils/validate-utils.js";
import ZodUtils from "../../utils/zod-utils.js";

const { handleValidationIssues, withSuperRefine } = ZodUtils;
const { ERROR_MESSAGES: { typeRequired, format, emptyString } } = ValidateUtils;
const pathSchema = withSuperRefine(
    z.string(typeRequired).trim().min(1, emptyString).regex(/^[^\p{Cc}\\]+$/u, format),
    pathCases
);
const dirSchema = z.object({ dir: pathSchema.default(".") });

function pathCases(source, ctx) {
    return handleValidationIssues([{
        condition: path.posix.isAbsolute(source) || source.split("/").some((part) => ["", ".", ".."].includes(part)),
        message: "Ruta no válida"
    }], ctx);
}

export default dirSchema;
export { pathSchema };
