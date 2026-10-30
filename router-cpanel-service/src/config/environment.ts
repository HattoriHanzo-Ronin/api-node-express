import "dotenv/config";
import { API_ERROR } from "./errors.js";
import ApiError from "../utils/error/api-error.js";
import type { Environment } from "../types/environment.js";

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
    JWT_ACCESS_TOKEN_EXPIRES_IN
} = process.env;
const ENV: Environment = Object.freeze({
    port: Number(PORT),
    publicUrl: PUBLIC_URL,
    chromePath: CHROME_PATH,
    displayBase: Number(DISPLAY_BASE),
    vncPortBase: Number(VNC_PORT_BASE),
    maxActiveUsers: Number(MAX_ACTIVE_USERS),
    maxSessionsPerUser: Number(MAX_SESSIONS_PER_USER),
    maxVncConnectionsPerSession: Number(MAX_VNC_CONNECTIONS_PER_SESSION),
    sessionInactivityTimeout: Number(SESSION_INACTIVITY_TIMEOUT),
    jwtAccessTokenExpiresIn: JWT_ACCESS_TOKEN_EXPIRES_IN
});

validateConfiguration(ENV);

function validateConfiguration(environment: Environment): void {
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
        jwtAccessTokenExpiresIn
    } = environment;
    const VALID_NUMBERS = [
        port,
        displayBase,
        vncPortBase,
        maxActiveUsers,
        maxSessionsPerUser,
        maxVncConnectionsPerSession,
        sessionInactivityTimeout
    ].every((value) => Number.isInteger(value) && value > 0);
    const VALID_STRINGS = [chromePath, jwtAccessTokenExpiresIn].every(
        (value) => typeof value === "string" && value.length > 0
    );
    const VALID_PUBLIC_URL = typeof publicUrl === "string" && URL.canParse(publicUrl);

    ApiError.handle([
        {
            condition: !VALID_NUMBERS || !VALID_STRINGS || !VALID_PUBLIC_URL,
            message: "La configuración del servicio de paneles de router no es válida",
            apiError: API_ERROR.configurationInvalid
        }
    ]);
}

export { ENV };
