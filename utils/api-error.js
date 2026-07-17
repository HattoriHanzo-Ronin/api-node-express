import { API_ERROR } from "../config/constants.js";

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
        this.code = apiError.code;
    }
}
