import { API_ERROR } from "../../config/errors.js";
import type { ApiErrorCode, ApiErrorOptions, ErrorCondition, ErrorDetail } from "../../types/utils/api-error.js";

/**
 * API error response
 *
 * @author HattoriHanzo-Ronin
 */
export default class ApiError extends Error {
    readonly status: number;
    readonly code: ApiErrorCode;
    readonly details?: ErrorDetail | ErrorDetail[];

    constructor({ message, details, status = 500, apiError = API_ERROR.internalError }: ApiErrorOptions) {
        super(message);
        this.name = "ApiError";
        this.details = details;
        this.status = status;
        this.code = apiError;
    }

    /**
     * Evaluates conditional API error actions
     *
     * @param errors Error conditions to evaluate
     * @param errors[].condition Indicates whether the condition matches
     * @param [errors[].execute] Action executed when the condition matches
     * @param [errors[].message] Error message
     * @param [errors[].status] HTTP status code
     * @param [errors[].apiError] API error code
     * @throws {ApiError} When a matching condition defines a message
     */
    static handle(errors: ErrorCondition[]): void {
        for (const { condition, execute, message, status, apiError } of errors) {
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
