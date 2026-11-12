import "dotenv/config";
import { API_ERROR } from "./errors.js";
import ApiError from "../utils/error/api-error.js";
import type { Environment } from "../types/config/environment.js";
import type { JwtExpiresIn } from "../types/utils/jwt-provider.js";
import type { LogLevel } from "../types/logger/logger.js";

const {
    PORT,
    PUBLIC_URL,
    CHROME_PATH,
    DISPLAY_BASE,
    VNC_PORT_BASE,
    MAX_ACTIVE_USERS,
    MAX_SESSIONS_PER_USER,
    MAX_VNC_CONNECTIONS_PER_SESSION,
    SESSION_INACTIVITY_TIMEOUT,
    JWT_ACCESS_TOKEN_EXPIRES_IN,
    LOG_LEVEL,
    LOG_DIRECTORY,
    LOG_RETENTION_WEEKS
} = process.env;
const ENV: Environment = Object.freeze(
    validateConfiguration({
        port: Number(PORT),
        publicUrl: PUBLIC_URL,
        chromePath: CHROME_PATH,
        displayBase: Number(DISPLAY_BASE),
        vncPortBase: Number(VNC_PORT_BASE),
        maxActiveUsers: Number(MAX_ACTIVE_USERS),
        maxSessionsPerUser: Number(MAX_SESSIONS_PER_USER),
        maxVncConnectionsPerSession: Number(MAX_VNC_CONNECTIONS_PER_SESSION),
        sessionInactivityTimeout: Number(SESSION_INACTIVITY_TIMEOUT),
        jwtAccessTokenExpiresIn: toJwtExpiresIn(JWT_ACCESS_TOKEN_EXPIRES_IN),
        logLevel: toLogLevel(LOG_LEVEL),
        logDirectory: LOG_DIRECTORY,
        logRetentionWeeks: Number(LOG_RETENTION_WEEKS)
    })
);

function validateConfiguration(environment: Partial<Environment>): Environment {
    const {
        port,
        publicUrl,
        chromePath,
        displayBase,
        vncPortBase,
        maxActiveUsers,
        maxSessionsPerUser,
        maxVncConnectionsPerSession,
        sessionInactivityTimeout,
        jwtAccessTokenExpiresIn,
        logLevel,
        logDirectory,
        logRetentionWeeks
    } = environment;
    const VALID_NUMBERS = [
        port,
        displayBase,
        vncPortBase,
        maxActiveUsers,
        maxSessionsPerUser,
        maxVncConnectionsPerSession,
        sessionInactivityTimeout,
        logRetentionWeeks
    ].every((value) => typeof value === "number" && Number.isInteger(value) && value > 0);
    const VALID_STRINGS = [chromePath, jwtAccessTokenExpiresIn].every(
        (value) => typeof value === "string" && value.length > 0
    );
    const VALID_PUBLIC_URL = typeof publicUrl === "string" && URL.canParse(publicUrl);

    ApiError.handle([
        {
            condition: !VALID_NUMBERS || !VALID_STRINGS || !VALID_PUBLIC_URL || !logLevel || !logDirectory?.trim(),
            message: "La configuración del servicio de paneles de router no es válida",
            apiError: API_ERROR.configurationInvalid
        }
    ]);
    return environment as Environment;
}

function toLogLevel(level: string | undefined): LogLevel | undefined {
    if (level === "debug" || level === "info" || level === "warn" || level === "error") {
        return level;
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
