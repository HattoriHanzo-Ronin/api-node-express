import z, { type RefinementCtx } from "zod";
import path from "node:path";
import ZodUtils from "../../utils/zod-utils.js";

const {
    handleValidationIssues,
    withSuperRefine,
    ERROR_MESSAGES: { typeRequired, format, emptyString }
} = ZodUtils;
const PATH_SCHEMA = withSuperRefine(
    z
        .string(typeRequired)
        .trim()
        .min(1, emptyString)
        .regex(/^[^\p{Cc}\\]+$/u, format),
    pathCases
);
const DIR_SCHEMA = z.object({ dir: PATH_SCHEMA.default(".") });

function pathCases(source: string, ctx: RefinementCtx): void {
    handleValidationIssues(
        [
            {
                condition:
                    path.posix.isAbsolute(source) || source.split("/").some((part) => ["", ".", ".."].includes(part)),
                message: "Ruta no válida"
            }
        ],
        ctx
    );
}

export { DIR_SCHEMA, PATH_SCHEMA };
