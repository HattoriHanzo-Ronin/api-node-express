import ApiError from "./error/api-error.js";
import { API_ERROR } from "../config/errors.js";

/**
 * Zod validation utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class ZodUtils {
    /**
     * Creates a case-insensitive enum schema
     *
     * @param {typeof import("zod")} z Zod namespace
     * @param {import("zod").ZodEnum} zodEnum Zod enum schema
     * @param {import("zod").RawCreateParams} errorMessage Validation error message
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
     * @returns {ZodSchema} Extended schema
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
            const details = result.error.issues.map((issue) => {
                const field = issue.path.join(".");
                const message = issue.code === "invalid_type" && issue.expected === "object"
                    ? "Debe enviar un objeto válido"
                    : issue.message;
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
                    ctx.addIssue({ code: "custom", path, message });
                }
            }
        }
    }
}
