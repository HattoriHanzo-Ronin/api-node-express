import fs from "fs";

const ENV = Object.freeze({
    port: Number(process.env.PORT),
    dbHost: process.env.HOSTDB,
    dbPort: Number(process.env.PORTDB),
    dbUser: process.env.USERDB,
    dbName: process.env.DB,
    ftpHost: process.env.HOSTFTP,
    ftpPort: Number(process.env.PORTFTP),
    chromePath: process.env.CHROME_PATH
});
const secretCache = {};
const SECRETS = Object.freeze({
    get passDb() {
        return getSecret("passDb", process.env.PASSDB_FILE);
    },
    get jwtSecret() {
        return getSecret("jwtSecret", process.env.JWT_SECRET_FILE);
    },
    get refreshJwtSecret() {
        return getSecret("refreshJwtSecret", process.env.REFRESH_JWT_SECRET_FILE);
    },
    get sftpKey() {
        return getSecret("sftpKey", process.env.SFTP_KEY_FILE);
    }
});
const FILE_TYPE = Object.freeze({ dir: "DIR", file: "FILE" });
const CONNECTION_CTYPE = Object.freeze({ wan: "WAN", lan: "LAN", wifi: "WIFI" });
const DEVICE_TYPE = Object.freeze({ client: "CLIENT", router: "ROUTER", server: "SERVER" });
const USER_ROLE = Object.freeze({ admin: "ADMIN", ftp: "FTP", net: "NET" });
const VALIDATION = deepFreeze({
    allowEnums: {
        fileType: Object.values(FILE_TYPE),
        connectionsCtype: Object.values(CONNECTION_CTYPE),
        devicesType: Object.values(DEVICE_TYPE),
        userRoles: Object.values(USER_ROLE)
    },
    errorMessages: {
        typeRequired: { error: (issue) => (issue.input === undefined ? "Requerido" : "Tipo no válido") },
        typeNotRequired: { error: "Tipo no válido" },
        format: "Error de formato",
        length: (num, mode) =>
            `Longitud ${mode === "min" ? "mínima" : "máxima"} ${num} ${num > 1 ? "caracteres" : "caracter"}`,
        invalidEnum: (values) => ({ error: `Valores permitidos: ${values.join(", ")}` }),
        invalidId: "UUID no válido",
        emptyArray: "Debe contener al menos un elemento",
        emptyString: "No puede estar vacío"
    },
    regex: {
        passwordRegex: /^[A-Za-z0-9!@#$%^&*()_\-+=\[{\]};:'",<.>/?\\|`~]+$/,
        macRegex: /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/,
        ipRegex: /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
        safeTextRegex: /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 -]+$/,
        pathRegex: /^[\p{L}\p{N} ./_-]+$/u
    }
});
const POSTGRES_ERROR = Object.freeze({
    uniqueViolation: "23505",
    foreignKeyViolation: "23503"
});
const API_ERROR = deepFreeze({
    internalError: { code: "INTERNAL_ERROR" },
    routeNotFound: { code: "ROUTE_NOT_FOUND" },
    validationFailed: { code: "VALIDATION_FAILED" },
    deviceNameAlreadyExists: { code: "DEVICE_NAME_ALREADY_EXISTS" },
    deviceIpAlreadyInUse: { code: "DEVICE_IP_ALREADY_IN_USE" },
    deviceNotFound: { code: "DEVICE_NOT_FOUND" },
    deviceEmptyUpdate: { code: "DEVICE_EMPTY_UPDATE" },
    connectionRequired: { code: "CONNECTION_REQUIRED" },
    connectionMacAlreadyExists: { code: "CONNECTION_MAC_ALREADY_EXISTS" },
    connectionCreateFailed: { code: "CONNECTION_CREATE_FAILED" },
    connectionUpdateFailed: { code: "CONNECTION_UPDATE_FAILED" },
    connectionMacMismatch: { code: "CONNECTION_MAC_MISMATCH" },
    whitelistAlreadyAllowed: { code: "WHITELIST_ALREADY_ALLOWED" },
    whitelistNotAllowed: { code: "WHITELIST_NOT_ALLOWED" },
    whitelistKeyGenerationFailed: { code: "WHITELIST_KEY_GENERATION_FAILED" },
    whitelistRouterNotFound: { code: "WHITELIST_ROUTER_NOT_FOUND" },
    routerImplementationNotFound: { code: "ROUTER_IMPLEMENTATION_NOT_FOUND" },
    routerAddFailed: { code: "ROUTER_ADD_FAILED" },
    routerDeleteFailed: { code: "ROUTER_DELETE_FAILED" },
    routerRollbackFailed: { code: "ROUTER_ROLLBACK_FAILED" },
    authenticationRequired: { code: "AUTHENTICATION_REQUIRED" },
    refreshTokenUserNotFound: { code: "REFRESH_TOKEN_USER_NOT_FOUND" },
    invalidToken: { code: "INVALID_TOKEN" },
    userUsernameAlreadyExists: { code: "USER_USERNAME_ALREADY_EXISTS" },
    userNotFound: { code: "USER_NOT_FOUND" },
    userInvalidCredentials: { code: "USER_INVALID_CREDENTIALS" },
    userEmptyUpdate: { code: "USER_EMPTY_UPDATE" },
    aclRoleRequired: { code: "ACL_ROLE_REQUIRED" },
    aclPermissionDenied: { code: "ACL_PERMISSION_DENIED" },
    aclRoleCreateFailed: { code: "ACL_ROLE_CREATE_FAILED" },
    aclRoleUpdateFailed: { code: "ACL_ROLE_UPDATE_FAILED" },
    ftpUploadFailed: { code: "FTP_UPLOAD_FAILED" },
    ftpDownloadFailed: { code: "FTP_DOWNLOAD_FAILED" },
    ftpDirFailed: { code: "FTP_DIR_FAILED" },
    ftpMkdirFailed: { code: "FTP_MKDIR_FAILED" },
    ftpMoveFailed: { code: "FTP_MOVE_FAILED" },
    ftpRenameFailed: { code: "FTP_RENAME_FAILED" },
    ftpDeleteFailed: { code: "FTP_DELETE_FAILED" },
    ftpFileRequired: { code: "FTP_FILE_REQUIRED" }
});
const JWT = Object.freeze({ accessTokenExpiresIn: "30min", refreshTokenExpiresIn: "60d" });

function getSecret(key, secretFile) {
    return (secretCache[key] ??= fs.readFileSync(secretFile, "utf8").trim());
}

function deepFreeze(object) {
    Object.values(object).forEach((it) => {
        if (it && (Array.isArray(it) || Object.getPrototypeOf(it) === Object.prototype)) {
            deepFreeze(it);
        }
    });
    return Object.freeze(object);
}

export { ENV, SECRETS, FILE_TYPE, DEVICE_TYPE, USER_ROLE, VALIDATION, POSTGRES_ERROR, API_ERROR, JWT };
