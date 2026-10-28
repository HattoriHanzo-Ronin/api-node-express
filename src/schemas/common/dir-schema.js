import z from "zod";
import path from "node:path";
import ValidateUtils from "../../utils/validate-utils.js";
import ZodUtils from "../../utils/zod-utils.js";

const { handleValidationIssues, withSuperRefine } = ZodUtils;
const { ERROR_MESSAGES } = ValidateUtils;
const { typeRequired, format, emptyString } = ERROR_MESSAGES;
const pathRegex = /^[^\p{Cc}\\]+$/u;
const pathSchema = withSuperRefine(
    z.string(typeRequired).trim().min(1, emptyString).regex(pathRegex, format),
    pathCases
);
const dirSchema = z.object({ dir: pathSchema.default(".") });

function pathCases(source, ctx) {
    return handleValidationIssues([{
        condition: path.posix.isAbsolute(source) || source.split("/").some((it) => ["", ".", ".."].includes(it)),
        message: "Ruta no válida"
    }], ctx);
}

export default dirSchema;
export { pathSchema };
