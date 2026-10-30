import { API_ERROR } from "../../config/errors.js";
import type { ApiErrorCode, ApiErrorOptions, ErrorCondition } from "../../types/api-error.js";

/**
 * API error response
 *
 * @author HattoriHanzo-Ronin
 */
export default class ApiError extends Error {
    readonly status: number;
    readonly code: ApiErrorCode;

    constructor({ message, status = 500, apiError = API_ERROR.internalError }: ApiErrorOptions) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = apiError;
    }

    /**
     * Evaluates conditional API error actions
     *
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
