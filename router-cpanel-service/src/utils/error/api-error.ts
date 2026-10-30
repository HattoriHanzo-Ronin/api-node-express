import { API_ERROR } from "../../config/errors.js";
import type { ApiErrorCode, ApiErrorParams, ErrorCondition } from "../../types/api-error.js";

/**
 * API error response
 *
 * @author HattoriHanzo-Ronin
 */
export default class ApiError extends Error {
    readonly status: number;
    readonly code: ApiErrorCode;

    constructor({ message, status = 500, apiError = API_ERROR.routerSessionFailed }: ApiErrorParams) {
        super(message);
        this.name = "ApiError";
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
