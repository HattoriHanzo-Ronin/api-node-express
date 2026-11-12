import "dotenv/config";
import { API_ERROR } from "./errors.js";
import ApiError from "../utils/error/api-error.js";
import type {
    Environment,
    ProtectedService,
    ProtectedUserReservations,
    ProtectedUsers
} from "../types/config/environment.js";
import type { JwtExpiresIn } from "../types/utils/jwt-provider.js";
import type { LogLevel } from "../types/logger/logger.js";

const {
    PORT,
    THUMBNAIL_GENERATOR_URL,
    ROUTER_CPANEL_SERVICE_URL,
    HOSTDB,
    PORTDB,
    USERDB,
    DB,
    HOSTFTP,
    PORTFTP,
    FTP_MAX_CONNECTIONS,
    FTP_MAX_TRANSFERS,
    FTP_IDLE_TIMEOUT,
    FTP_SCALE_WAIT,
    PROTECTED_USERS,
    FTP_WATCHER_POOL_MIN,
    FTP_WATCHER_POOL_MAX,
    FTP_INTERACTIVE_POOL_MIN,
    FTP_INTERACTIVE_POOL_MAX,
    FTP_TRANSFER_POOL_MAX,
    FTP_TRANSFER_POOL_MIN,
    FTP_MEDIA_SESSION_TIMEOUT,
    FTP_TRANSFER_SESSION_TIMEOUT,
    FTP_MAX_UPLOAD_CHUNK_SIZE,
    FTP_MAX_THUMBNAIL_SIZE,
    FTP_DIRECTORY_CHECK_TIMEOUT,
    MEMORY_CACHE_MAX_SIZE,
    MEMORY_CACHE_MAX_SIZE_PER_OWNER,
    MEMORY_CACHE_INACTIVITY_TIMEOUT,
    DIRECTORY_CACHE_INACTIVITY_TIMEOUT,
    JWT_ACCESS_TOKEN_EXPIRES_IN,
    JWT_REFRESH_TOKEN_EXPIRES_IN,
    SOCKET_MAX_CONNECTIONS,
    SOCKET_MAX_CONNECTIONS_PER_USER,
    SOCKET_SESSION_INACTIVITY_TIMEOUT,
    SOCKET_PING_TIMEOUT,
    CHROME_PATH,
    LOG_LEVEL,
    LOG_DIRECTORY,
    LOG_RETENTION_WEEKS
} = process.env;
const PROTECTED_SERVICE = Object.freeze({ ftp: "ftp", socket: "socket" } as const);
const ENV: Environment = Object.freeze(
    validateConfiguration({
        port: Number(PORT),
        thumbnailGeneratorUrl: THUMBNAIL_GENERATOR_URL,
        routerCpanelServiceUrl: ROUTER_CPANEL_SERVICE_URL,
        dbHost: HOSTDB,
        dbPort: Number(PORTDB),
        dbUser: USERDB,
        dbName: DB,
        ftpHost: HOSTFTP,
        ftpPort: Number(PORTFTP),
        ftpMaxConnections: Number(FTP_MAX_CONNECTIONS),
        ftpMaxTransfers: Number(FTP_MAX_TRANSFERS),
        ftpIdleTimeout: Number(FTP_IDLE_TIMEOUT),
        ftpScaleWait: Number(FTP_SCALE_WAIT),
        protectedUsers: parseProtectedUsers(PROTECTED_USERS),
        ftpWatcherPoolMin: Number(FTP_WATCHER_POOL_MIN),
        ftpWatcherPoolMax: Number(FTP_WATCHER_POOL_MAX),
        ftpInteractivePoolMin: Number(FTP_INTERACTIVE_POOL_MIN),
        ftpInteractivePoolMax: Number(FTP_INTERACTIVE_POOL_MAX),
        ftpTransferPoolMin: Number(FTP_TRANSFER_POOL_MIN),
        ftpTransferPoolMax: Number(FTP_TRANSFER_POOL_MAX),
        ftpMediaSessionTimeout: Number(FTP_MEDIA_SESSION_TIMEOUT),
        ftpTransferSessionTimeout: Number(FTP_TRANSFER_SESSION_TIMEOUT),
        ftpMaxUploadChunkSize: Number(FTP_MAX_UPLOAD_CHUNK_SIZE),
        ftpMaxThumbnailSize: Number(FTP_MAX_THUMBNAIL_SIZE),
        ftpDirectoryCheckTimeout: Number(FTP_DIRECTORY_CHECK_TIMEOUT),
        memoryCacheMaxSize: Number(MEMORY_CACHE_MAX_SIZE),
        memoryCacheMaxSizePerOwner: Number(MEMORY_CACHE_MAX_SIZE_PER_OWNER),
        memoryCacheInactivityTimeout: Number(MEMORY_CACHE_INACTIVITY_TIMEOUT),
        directoryCacheInactivityTimeout: Number(DIRECTORY_CACHE_INACTIVITY_TIMEOUT),
        jwtAccessTokenExpiresIn: toJwtExpiresIn(JWT_ACCESS_TOKEN_EXPIRES_IN),
        jwtRefreshTokenExpiresIn: toJwtExpiresIn(JWT_REFRESH_TOKEN_EXPIRES_IN),
        socketMaxConnections: Number(SOCKET_MAX_CONNECTIONS),
        socketMaxConnectionsPerUser: Number(SOCKET_MAX_CONNECTIONS_PER_USER),
        socketSessionInactivityTimeout: Number(SOCKET_SESSION_INACTIVITY_TIMEOUT),
        socketPingTimeout: Number(SOCKET_PING_TIMEOUT),
        chromePath: CHROME_PATH,
        logLevel: toLogLevel(LOG_LEVEL),
        logDirectory: LOG_DIRECTORY,
        logRetentionWeeks: Number(LOG_RETENTION_WEEKS)
    })
);

function invalidConfig(condition: boolean): void {
    ApiError.handle([
        {
            condition,
            message: "La configuración de la aplicación no es válida",
            apiError: API_ERROR.configurationInvalid
        }
    ]);
}

function validateConfiguration(environment: Partial<Environment>): Environment {
    let memoryCacheMaxSizePerOwner = 0;
    let memoryCacheMaxSize = 0;
    Object.entries(environment).forEach(([key, value]) => {
        if (key === "protectedUsers") {
            return;
        }

        invalidConfig(value === undefined);
        switch (typeof value) {
            case "number": {
                const validNumber =
                    Number.isInteger(value) && (key === "ftpMaxUploadChunkSize" ? value >= 0 : value > 0);
                invalidConfig(!validNumber);
                if (key === "memoryCacheMaxSizePerOwner") {
                    memoryCacheMaxSizePerOwner = value;
                }

                if (key === "memoryCacheMaxSize") {
                    memoryCacheMaxSize = value;
                }

                break;
            }
            case "string": {
                const validStrings = key === "logDirectory" ? value.trim().length > 0 : value.length > 0;
                const validUrls =
                    !["thumbnailGeneratorUrl", "routerCpanelServiceUrl"].includes(key) || URL.canParse(value);
                invalidConfig(!validStrings || !validUrls);
                break;
            }
            default: {
                invalidConfig(true);
            }
        }
    });
    invalidConfig(memoryCacheMaxSizePerOwner >= memoryCacheMaxSize);
    return environment as Environment;
}

function parseProtectedUsers(source: string | undefined): ProtectedUsers {
    const invalidSource = typeof source !== "string";
    invalidConfig(invalidSource);
    if (source === "") {
        return Object.freeze({});
    }

    const users: Record<string, ProtectedUserReservations> = {};
    if (!invalidSource) {
        for (const entry of source.split(",")) {
            const [id, services] = entry.trim().split(":");
            const reservations: Partial<Record<ProtectedService, number>> = {};
            invalidConfig(!id || !services || users[id] !== undefined);
            for (const service of services.split("|")) {
                const [name, value] = service.split("=");
                const reserved = Number(value);
                const invalidReserve =
                    !isProtectedService(name) ||
                    !Number.isInteger(reserved) ||
                    reserved < 1 ||
                    reservations[name] !== undefined;
                invalidConfig(invalidReserve);

                if (!invalidReserve) {
                    reservations[name] = reserved;
                }
            }
            users[id] = Object.freeze(reservations);
        }
    }

    return Object.freeze(users);
}

function isProtectedService(value: string): value is ProtectedService {
    return value === PROTECTED_SERVICE.ftp || value === PROTECTED_SERVICE.socket;
}

function toLogLevel(value: string | undefined): LogLevel | undefined {
    if (value === "debug" || value === "info" || value === "warn" || value === "error") {
        return value;
    }

    return undefined;
}

function toJwtExpiresIn(value: string | undefined): JwtExpiresIn | undefined {
    if (!value || !isJwtExpiresIn(value)) {
        return undefined;
    }

    return value;
}

function isJwtExpiresIn(value: string): value is JwtExpiresIn {
    return /^\d+(?:\.\d+)?\s*(?:ms|s|m|h|d|w|y|sec(?:ond)?s?|min(?:ute)?s?|hr(?:s)?|hour(?:s)?|day(?:s)?|week(?:s)?|year(?:s)?)$/i.test(
        value
    );
}

export { ENV };
