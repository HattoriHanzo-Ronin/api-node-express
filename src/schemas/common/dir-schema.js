import z from "zod";
import ValidateUtils from "../../utils/validate-utils.js";

const { handleValidationIssues, withSuperRefine } = ValidateUtils;
const { ERROR_MESSAGES, REGEX } = ValidateUtils;
const { typeNotRequired, format, emptyString } = ERROR_MESSAGES;
const { pathRegex } = REGEX;
const dirSchema = z.object({
    dir: withSuperRefine(
        z.string(typeNotRequired).trim().min(1, emptyString).regex(pathRegex, format).default("."),
        pathCases
    )
});

function pathCases(path, ctx) {
    return handleValidationIssues(
        [{ condition: path && path.split("/").some((it) => it.trim() === ".."), message: "Ruta no válida" }],
        ctx
    );
}

export default dirSchema;
