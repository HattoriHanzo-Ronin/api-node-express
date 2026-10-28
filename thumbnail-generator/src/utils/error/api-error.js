import { API_ERROR } from "../../config/errors.js";

/**
 * API error response
 *
 * @author HattoriHanzo-Ronin
 */
export default class ApiError extends Error {
    constructor({ message, status = 500, apiError = API_ERROR.internalError }) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = apiError;
    }

    /**
     * Evaluates conditional API error actions
     *
     * @param {Object[]} errors Error conditions to evaluate
     * @param {boolean} errors[].condition Indicates whether the rule matches
     * @param {Function} [errors[].execute] Action executed when the condition matches
     * @param {string} [errors[].message] Error message
     * @param {number} [errors[].status] HTTP status code
     * @param {string} [errors[].apiError] API error code
     */
    static handle(errors) {
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
