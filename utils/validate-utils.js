import ApiError from "./api-error.js";

/**
 * Validation utilities.
 *
 * @author HattoriHanzo-Ronin
 */
export default class ValidateUtils {
    static ALLOW_ENUMS = Object.freeze({
        fileType: Object.freeze(["DIR", "FILE"])
    });

    static ERROR_MESSAGES = Object.freeze({
        typeRequired: {
            error: (issue) => (issue.input === undefined ? "Requerido" : "Tipo no válido")
        },
        typeNotRequired: { error: "Tipo no válido" },
        format: "Error de formato",
        length: (num, mode) => `Longitud ${mode === "min" ? "mínima" : "máxima"} ${num} caracteres`,
        requiredEnum: (message) => ({
            error: (issue) => (issue.input === undefined ? "Requerido" : message)
        }),
        invalidEnum: (name, values) => `Valor inválido para ${name}. Valores permitidos: ${values.join(", ")}`
    });

    static REGEX = Object.freeze({
        pathRegex: /^[\p{L}\p{N} ./_-]+$/u
    });

    /**
     * Creates a case-insensitive enum schema.
     *
     * @param {typeof import("zod")} z Zod namespace
     * @param {import("zod").ZodEnum} zodEnum Zod enum schema
     * @returns {import("zod").ZodPipe} Normalized enum schema
     */
    static zodEnumIgnoreCase(z, zodEnum) {
        return z.string().trim().toUpperCase().pipe(zodEnum);
    }

    /**
     * Validates data against a schema.
     *
     * @param {Object} data Data to validate
     * @param {import("zod").ZodType} schema Validation schema
     * @returns {Object} Parsed data
     */
    static validateData(data, schema) {
        const result = schema.safeParse(data);
        if (!result.success) {
            const error = new Error("Error al validar los datos");
            error.status = 400;
            error.details = result.error.issues.map((e) => ({
                field: e.path[0],
                message:
                    e.code === "invalid_type" && e.expected === "object" ? "Debe enviar un objeto válido" : e.message
            }));
            throw error;
        }

        return result.data;
    }

    /**
     * Handles API error conditions.
     *
     * @param {Object[]} errors Error conditions to evaluate
     * @param {boolean} errors[].condition Indicates whether the error should be handled
     * @param {Function | undefined} errors[].execute Function to execute when condition is met
     * @param {string | undefined} errors[].message Error message
     * @param {number | undefined} errors[].status HTTP status code
     */
    static handleApiErrors(errors) {
        for (const error of errors) {
            const { condition, execute, message, status } = error;
            if (condition) {
                if (execute) {
                    execute();
                }

                if (message) {
                    throw new ApiError(message, status);
                }
            }
        }
    }

    /**
     * Handles schema validation issues.
     *
     * @param {Object[]} issues Validation issues to evaluate
     * @param {boolean} issues[].condition Indicates whether the issue should be added
     * @param {string[] | undefined} issues[].path Validation issue path
     * @param {string | undefined} issues[].message Validation issue message
     * @param {Function | undefined} issues[].execute Function to execute when condition is met
     * @param {import("zod").RefinementCtx} ctx Zod validation context
     */
    static handleValidationIssues(issues, ctx) {
        for (const issue of issues) {
            const { condition, path, message, execute } = issue;
            if (condition) {
                if (execute) {
                    execute();
                }

                if (message) {
                    ctx.addIssue({
                        code: "custom",
                        path,
                        message
                    });
                }
            }
        }
    }
}
