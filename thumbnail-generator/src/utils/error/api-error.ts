import { API_ERROR } from "../../config/errors.js";
import type { ApiErrorCode, ApiErrorOptions, ErrorCondition } from "../../types/utils/api-error.js";

/**
 * API error response
 *
 * @author HattoriHanzo-Ronin
 */
export default class ApiError extends Error {
    readonly status: number;
    readonly code: ApiErrorCode;
    readonly context?: Record<string, unknown>;

    constructor({ message, status = 500, apiError = API_ERROR.internalError, cause, context }: ApiErrorOptions) {
        super(message, { cause });
        this.name = "ApiError";
        this.status = status;
        this.code = apiError;
        this.context = context;
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
     * @param [errors[].cause] Original error
     * @param [errors[].context] Diagnostic context
     * @throws {ApiError} When a matching condition defines a message
     */
    static handle(errors: ErrorCondition[]): void {
        for (const { condition, execute, message, status, apiError, cause, context } of errors) {
            if (condition) {
                if (execute) {
                    execute();
                }

                if (message) {
                    throw new ApiError({ message, status, apiError, cause, context });
                }
            }
        }
    }
}
