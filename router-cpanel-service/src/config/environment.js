import "dotenv/config";
import { API_ERROR } from "./errors.js";
import ApiError from "../utils/error/api-error.js";

const ENV = Object.freeze({
    port: Number(process.env.PORT),
    publicUrl: process.env.PUBLIC_URL,
    chromePath: process.env.CHROME_PATH,
    displayBase: Number(process.env.DISPLAY_BASE),
    vncPortBase: Number(process.env.VNC_PORT_BASE),
    maxActiveUsers: Number(process.env.MAX_ACTIVE_USERS),
    maxSessionsPerUser: Number(process.env.MAX_SESSIONS_PER_USER),
    maxVncConnectionsPerSession: Number(process.env.MAX_VNC_CONNECTIONS_PER_SESSION),
    sessionInactivityTimeout: Number(process.env.SESSION_INACTIVITY_TIMEOUT),
    jwtAccessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN
});

validateConfiguration(ENV);

function validateConfiguration(environment) {
    const validNumbers = [
        environment.port,
        environment.displayBase,
        environment.vncPortBase,
        environment.maxActiveUsers,
        environment.maxSessionsPerUser,
        environment.maxVncConnectionsPerSession,
        environment.sessionInactivityTimeout
    ].every((value) => Number.isInteger(value) && value > 0);
    const validStrings = [environment.chromePath, environment.jwtAccessTokenExpiresIn].every((value) => typeof value === "string" && value.length > 0);
    const validPublicUrl = typeof environment.publicUrl === "string" && URL.canParse(environment.publicUrl);

    ApiError.handle([{
        condition: !validNumbers || !validStrings || !validPublicUrl,
        message: "La configuración del servicio de paneles de router no es válida",
        apiError: API_ERROR.configurationInvalid
    }]);
}

export { ENV };
