import ApiError from "./error/api-error.js";
import type { ApiErrorCode } from "../types/utils/api-error.js";
import type { ValidateRegex } from "../types/utils/validate-utils.js";

/**
 * Validation utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class ValidateUtils {
    static readonly REGEX: ValidateRegex = Object.freeze({
        passwordRegex: /^[A-Za-z0-9!@#$%^&*()_\-+=\[{\]};:'",<.>/?\\|`~]+$/
    });

    /**
     * Validates that an object contains at least one property
     *
     * @param data Object to validate
     * @param apiError API error when the object is empty
     */
    static validateNotEmptyObject(data: object, apiError: ApiErrorCode): void {
        if (Object.keys(data).length === 0) {
            throw new ApiError({
                message: "No hay campos para actualizar",
                status: 400,
                apiError
            });
        }
    }
}
