import ApiError from "./error/api-error.js";
import ObjectUtils from "./object-utils.js";
import { CONNECTION_CTYPE, DATA_VERSION, DEVICE_TYPE, FILE_TYPE, USER_ROLE } from "../config/constants.js";
import { API_ERROR } from "../config/errors.js";

/**
 * Validation utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class ValidateUtils {
    static ALLOW_ENUMS = ObjectUtils.deepFreeze({
        fileType: Object.values(FILE_TYPE),
        connectionsCtype: Object.values(CONNECTION_CTYPE),
        devicesType: Object.values(DEVICE_TYPE),
        userRoles: Object.values(USER_ROLE),
        dataVersions: Object.values(DATA_VERSION)
    });

    static ERROR_MESSAGES = ObjectUtils.deepFreeze({
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

    static REGEX = ObjectUtils.deepFreeze({
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
                apiError: API_ERROR.validationFailed
            });
        }

        return result.data;
    }

    /**
     * Validates that an object contains at least one property
     *
     * @param {Object} data Object to validate
     * @param {{ code: string }} apiError API error
     */
    static validateNotEmptyObject(data, apiError) {
        if (Object.keys(data).length === 0) {
            throw new ApiError({
                message: "No hay campos para actualizar",
                status: 400,
                apiError
            });
        }
    }

    /**
     * Evaluates a list of conditional actions and throws an ApiError when required
     *
     * @param {Object[]} errors Error conditions to evaluate
     * @param {boolean} errors[].condition Indicates whether the rule matches
     * @param {Function} [errors[].execute] Action executed when the condition matches
     * @param {string} [errors[].message] Error message
     * @param {number} [errors[].status] HTTP status code
     * @param {{ code: string }} [errors[].apiError] API error
     */
    static handleApiErrors(errors) {
        for (const error of errors) {
            const { condition, execute, message, status, apiError } = error;
            if (condition) {
                if (execute) {
                    execute();
                }

                if (message) {
                    throw new ApiError({ message, status, apiError });
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
