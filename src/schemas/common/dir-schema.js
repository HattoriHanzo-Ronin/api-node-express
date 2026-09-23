import z from "zod";
import { VALIDATION } from "../../config/constants.js";
import ValidateUtils from "../../utils/validate-utils.js";

const { handleValidationIssues, withSuperRefine } = ValidateUtils;
const { errorMessages, regex } = VALIDATION;
const { typeNotRequired, format, emptyString } = errorMessages;
const { pathRegex } = regex;
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
