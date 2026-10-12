import z from "zod";
import path from "node:path";
import ValidateUtils from "../../utils/validate-utils.js";

const { handleValidationIssues, withSuperRefine } = ValidateUtils;
const { ERROR_MESSAGES, REGEX } = ValidateUtils;
const { typeRequired, format, emptyString } = ERROR_MESSAGES;
const { pathRegex } = REGEX;
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
