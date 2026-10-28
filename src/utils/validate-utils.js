import ApiError from "./error/api-error.js";
import ObjectUtils from "./object-utils.js";
import { API_ERROR } from "../config/errors.js";

/**
 * Validation utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class ValidateUtils {
    static ERROR_MESSAGES = ObjectUtils.deepFreeze({
        typeRequired: { error: (issue) => (issue.input === undefined ? "Requerido" : "Tipo no válido") },
        typeNotRequired: { error: "Tipo no válido" },
        format: "Error de formato",
        length: (num, mode) =>
            `Longitud ${mode === "min" ? "mínima" : "máxima"} ${num} ${num > 1 ? "caracteres" : "caracter"}`,
        invalidEnum: (values) => ({ error: `Valores permitidos: ${values.join(", ")}` }),
        emptyArray: "Debe contener al menos un elemento",
        emptyString: "No puede estar vacío"
    });

    static REGEX = ObjectUtils.deepFreeze({
        passwordRegex: /^[A-Za-z0-9!@#$%^&*()_\-+=\[{\]};:'",<.>/?\\|`~]+$/
    });

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
}
