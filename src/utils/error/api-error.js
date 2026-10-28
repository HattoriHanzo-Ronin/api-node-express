import { API_ERROR } from "../../config/errors.js";

/**
 * Custom API error
 *
 * @author HattoriHanzo-Ronin
 */
export default class ApiError extends Error {
    constructor({ message, status = 500, apiError = API_ERROR.internalError, details = null }) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.details = details;
        this.code = apiError;
    }

    /**
     * Evaluates conditional API errors
     *
     * @param {Object[]} errors Error conditions
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
