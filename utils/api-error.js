import { API_ERROR } from "../config/constants.js";

/**
 * Custom API error
 *
 * @author HattoriHanzo-Ronin
 */
export default class ApiError extends Error {
    constructor({ message, status = 500, code = "INTERNAL_ERROR", details = null }) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.details = details;
        this.code = code;
        if (code && !Object.values(API_ERROR).some((it) => it.code === code)) {
            throw new Error(`Unknown ApiError code: { code: ${code} }`);
        }
    }
}
