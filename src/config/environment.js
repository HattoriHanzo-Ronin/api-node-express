import { API_ERROR } from "./errors.js";
import ApiError from "../utils/error/api-error.js";

const ENV = Object.freeze({
    port: Number(process.env.PORT),
    apiUrl: process.env.API_URL,
    thumbnailGeneratorUrl: process.env.THUMBNAIL_GENERATOR_URL,
    routerCpanelServiceUrl: process.env.ROUTER_CPANEL_SERVICE_URL,
    dbHost: process.env.HOSTDB,
    dbPort: Number(process.env.PORTDB),
    dbUser: process.env.USERDB,
    dbName: process.env.DB,
    ftpHost: process.env.HOSTFTP,
    ftpPort: Number(process.env.PORTFTP),
    ftpMaxConnections: Number(process.env.FTP_MAX_CONNECTIONS),
    ftpMaxTransfers: Number(process.env.FTP_MAX_TRANSFERS),
    ftpIdleTimeout: Number(process.env.FTP_IDLE_TIMEOUT),
    ftpScaleWait: Number(process.env.FTP_SCALE_WAIT),
    ftpProtectedUserIds: process.env.FTP_PROTECTED_USER_IDS,
    ftpInternalPoolMin: Number(process.env.FTP_INTERNAL_POOL_MIN),
    ftpInternalPoolMax: Number(process.env.FTP_INTERNAL_POOL_MAX),
    ftpReadPoolMin: Number(process.env.FTP_READ_POOL_MIN),
    ftpReadPoolMax: Number(process.env.FTP_READ_POOL_MAX),
    ftpWritePoolMin: Number(process.env.FTP_WRITE_POOL_MIN),
    ftpWritePoolMax: Number(process.env.FTP_WRITE_POOL_MAX),
    ftpMediaSessionTimeout: Number(process.env.FTP_MEDIA_SESSION_TIMEOUT),
    ftpTransferSessionTimeout: Number(process.env.FTP_TRANSFER_SESSION_TIMEOUT),
    ftpMaxUploadChunkSize: Number(process.env.FTP_MAX_UPLOAD_CHUNK_SIZE),
    ftpMaxThumbnailSize: Number(process.env.FTP_MAX_THUMBNAIL_SIZE),
    ftpDirectoryCheckTimeout: Number(process.env.FTP_DIRECTORY_CHECK_TIMEOUT),
    memoryCacheMaxSize: Number(process.env.MEMORY_CACHE_MAX_SIZE),
    memoryCacheMaxSizePerOwner: Number(process.env.MEMORY_CACHE_MAX_SIZE_PER_OWNER),
    memoryCacheInactivityTimeout: Number(process.env.MEMORY_CACHE_INACTIVITY_TIMEOUT),
    directoryCacheInactivityTimeout: Number(process.env.DIRECTORY_CACHE_INACTIVITY_TIMEOUT),
    jwtAccessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN,
    jwtRefreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN,
    chromePath: process.env.CHROME_PATH
});

validateConfiguration(ENV);

function validateConfiguration(environment) {
    const numericEntries = Object.entries(environment).filter(([, value]) => typeof value === "number");
    const validNumbers = numericEntries.every(([key, value]) =>
        Number.isInteger(value) && (key === "ftpMaxUploadChunkSize" ? value >= 0 : value > 0)
    );
    const validStrings = typeof environment.ftpProtectedUserIds === "string" && [
        environment.jwtAccessTokenExpiresIn,
        environment.jwtRefreshTokenExpiresIn
    ].every((value) => typeof value === "string" && value.length > 0);
    const validUrls = [environment.apiUrl, environment.thumbnailGeneratorUrl, environment.routerCpanelServiceUrl]
        .every((value) => typeof value === "string" && URL.canParse(value));
    const validCacheLimits = environment.memoryCacheMaxSizePerOwner <= environment.memoryCacheMaxSize;
    if (!validNumbers || !validStrings || !validUrls || !validCacheLimits) {
        throw new ApiError({
            message: "La configuración de la aplicación no es válida",
            apiError: API_ERROR.configurationInvalid
        });
    }
}

export { ENV };
