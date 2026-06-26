import ApiError from "./api-error.js";

/**
 * Validation utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class ValidateUtils {
    static ALLOW_ENUMS = Object.freeze({
        fileType: Object.freeze(["DIR", "FILE"]),
        devicesIntrface: Object.freeze(["WAN", "LAN", "WIFI"]),
        devicesType: Object.freeze(["CLIENT", "ROUTER", "SERVER"]),
        userRoles: Object.freeze(["ADMIN", "FTP", "NET"])
    });

    static ERROR_MESSAGES = Object.freeze({
        typeRequired: { error: (issue) => (issue.input === undefined ? "Requerido" : "Tipo no válido") },
        typeNotRequired: { error: "Tipo no válido" },
        format: "Error de formato",
        length: (num, mode) =>
            `Longitud ${mode === "min" ? "mínima" : "máxima"} ${num} ${num > 1 ? "caracteres" : "caracter"}`,
        invalidEnum: (values) => ({ error: `Valores permitidos: ${values.join(", ")}` }),
        invalidId: "UUID no válido",
        emptyArray: "Debe contener al menos un elemento",
        emptyString: "No puede estar vacío"
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
     * Extends a schema with required properties
     *
     * @param {ZodSchema} schema Base schema
     * @param {object} properties Required properties
     * @returns {ZodSchema} Extended schema
     */
    static useRequiredProperties(schema, properties) {
        return schema.extend(properties);
    }

    /**
     * Extends a schema with cross-field validation rules
     *
     * @param {ZodSchema} schema Base schema
     * @param {(ctx: import("zod").RefinementCtx) => void} cases Custom validation callback
     * @returns {ZodSchema} Schema with additional validation rules
     */
    static withSuperRefine(schema, cases) {
        return schema.superRefine((data, ctx) => cases(data, ctx));
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
            throw new ApiError({
                message: "Error al validar los datos",
                status: 400,
                details,
                code: "VALIDATION_FAILED"
            });
        }

        return result.data;
    }

    /**
     * Evaluates a list of conditional actions and throws an ApiError when required
     *
     * @param {Object[]} errors Error conditions to evaluate
     * @param {boolean} errors[].condition Indicates whether the rule matches
     * @param {Function} [errors[].execute] Action executed when the condition matches
     * @param {string} [errors[].message] Error message
     * @param {number} [errors[].status] HTTP status code
     * @param {string} [errors[].code] Application error code
     */
    static handleApiErrors(errors) {
        for (const error of errors) {
            const { condition, execute, message, status, code } = error;
            if (condition) {
                if (execute) {
                    execute();
                }

                if (message) {
                    throw new ApiError({ message, status, code });
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
