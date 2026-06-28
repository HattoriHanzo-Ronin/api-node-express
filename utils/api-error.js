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
        if (code && !Object.hasOwn(ApiError.ERROR, code)) {
            throw new Error(`Unknown ApiError code: { code: ${code} }`);
        }
    }

    static ERROR = Object.freeze({
        INTERNAL_ERROR: { code: "INTERNAL_ERROR" },
        ROUTE_NOT_FOUND: { code: "PAGE_NOT_FOUND" },
        DATABASE_CONNECTION_FAILED: { code: "DATABASE_CONNECTION_FAILED" },
        DATABASE_TIMEOUT: { code: "DATABASE_TIMEOUT" },
        VALIDATION_FAILED: { code: "VALIDATION_FAILED" },
        DEVICE_MAC_ALREADY_EXISTS: { code: "DEVICE_MAC_ALREADY_EXISTS" },
        DEVICE_IP_ALREADY_IN_USE: { code: "DEVICE_IP_ALREADY_IN_USE" },
        DEVICE_NOT_FOUND: { code: "DEVICE_NOT_FOUND" },
        USER_USERNAME_ALREADY_EXISTS: { code: "USER_USERNAME_ALREADY_EXISTS" },
        USER_NOT_FOUND: { code: "USER_NOT_FOUND" },
        USER_INVALID_CREDENTIALS: { code: "USER_INVALID_CREDENTIALS" },
        REFRESH_TOKENS_USER_NOT_FOUND: { code: "REFRESH_TOKENS_USER_NOT_FOUND" },
        WHITELIST_ALREADY_ALLOWED: { code: "WHITELIST_ALREADY_ALLOWED" },
        WHITELIST_NOT_ALLOWED: { code: "WHITELIST_NOT_ALLOWED" },
        WHITELIST_KEY_GENERATION_FAILED: { code: "WHITELIST_KEY_GENERATION_FAILED" },
        WHITELIST_ROUTER_NOT_FOUND: { code: "WHITELIST_ROUTER_NOT_FOUND" },
        WHITELIST_DEVICE_NOT_FOUND: { code: "WHITELIST_DEVICE_NOT_FOUND" },
        AUTHENTICATION_REQUIRED: { code: "AUTHENTICATION_REQUIRED" },
        INVALID_TOKEN: { code: "INVALID_TOKEN" },
        ACL_ROLE_REQUIRED: { code: "ACL_ROLE_REQUIRED" },
        ACL_PERMISSION_DENIED: { code: "ACL_PERMISSION_DENIED" },
        ACL_ROLE_CREATE_FAILED: { code: "ACL_ROLE_CREATE_FAILED" },
        ACL_ROLE_UPDATE_FAILED: { code: "ACL_ROLE_UPDATE_FAILED" },
        FTP_CONNECTION_FAILED: { code: "FTP_CONNECTION_FAILED" },
        FTP_TIMEOUT: { code: "FTP_TIMEOUT" },
        FTP_UPLOAD_FAILED: { code: "FTP_UPLOAD_FAILED" },
        FTP_DOWNLOAD_FAILED: { code: "FTP_DOWNLOAD_FAILED" },
        FTP_DIR_FAILED: { code: "FTP_DIR_FAILED" },
        FTP_MKDIR_FAILED: { code: "FTP_MKDIR_FAILED" },
        FTP_DELETE_FAILED: { code: "FTP_DELETE_FAILED" },
        FTP_FILE_REQUIRED: { code: "FTP_FILE_REQUIRED" },
        ROUTER_IMPLEMENTATION_NOT_FOUND: { code: "ROUTER_IMPLEMENTATION_NOT_FOUND" },
        ROUTER_ADD_FAILED: { code: "ROUTER_ADD_FAILED" },
        ROUTER_DELETE_FAILED: { code: "ROUTER_DELETE_FAILED" },
        ROUTER_ROLLBACK_FAILED: { code: "ROUTER_ROLLBACK_FAILED" }
    });
}
