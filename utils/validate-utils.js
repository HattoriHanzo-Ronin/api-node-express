import ApiError from "./api-error.js";

/**
 * Validation utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class ValidateUtils {
    static ALLOW_ENUMS = Object.freeze({
        fileType: Object.freeze(["DIR", "FILE"]),
        deviceIntrface: Object.freeze(["WAN", "LAN", "WIFI"]),
        deviceType: Object.freeze(["CLIENT", "ROUTER", "SERVER"])
    });

    static ERROR_MESSAGES = Object.freeze({
        typeRequired: { error: (issue) => (issue.input === undefined ? "Requerido" : "Tipo no válido") },
        typeNotRequired: { error: "Tipo no válido" },
        format: "Error de formato",
        length: (num, mode) => {
            return `Longitud ${mode === "min" ? "mínima" : "máxima"} ${num} ${num > 1 ? "caracteres" : "caracter"}`;
        },
        invalidEnum: (values) => ({ error: `Valores permitidos: ${values.join(", ")}` }),
        invalidId: "UUID no válido"
    });

    static REGEX = Object.freeze({
        passwordRegex: /^[A-Za-z0-9!@#$%^&*()_\-+=\[{\]};:'",<.>/?\\|`~]+$/,
        macRegex: /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/,
        ipRegex: /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
        safeTextRegex: /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 -]+$/,
        pathRegex: /^[\p{L}\p{N} ./_-]+$/u
    });

    /**
     * Creates a case-insensitive enum schema
     *
     * @param {typeof import("zod")} z Zod namespace
     * @param {import("zod").ZodEnum} zodEnum Zod enum schema
     * @param {import("zod").RawCreateParams} errorMessage validation error message
     * @returns {import("zod").ZodPipe} Normalized enum schema
     */
    static zodEnumIgnoreCase(z, zodEnum, errorMessage) {
        return z.string(errorMessage).trim().toUpperCase().pipe(zodEnum);
    }

    /**
     * Validates data against a schema
     *
     * @param {Object} data Data to validate
     * @param {import("zod").ZodType} schema Validation schema
     * @returns {Object} Parsed data
     */
    static validateData(data, schema) {
        const result = schema.safeParse(data);
        if (!result.success) {
            const details = result.error.issues.map((e) => {
                const field = e.path.join(".");
                const message =
                    e.code === "invalid_type" && e.expected === "object" ? "Debe enviar un objeto válido" : e.message;

                return field ? { field, message } : { message };
            });
            throw new ApiError("Error al validar los datos", 400, details);
        }

        return result.data;
    }

    /**
     * Handles API error conditions
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
     * Handles schema validation issues
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
