import type { JwtExpiresIn } from "../utils/jwt-provider.js";
import type { LogLevel } from "../logger/logger.js";

export type Environment = Readonly<{
    port: number;
    publicUrl: string;
    chromePath: string;
    displayBase: number;
    vncPortBase: number;
    maxActiveUsers: number;
    maxSessionsPerUser: number;
    maxVncConnectionsPerSession: number;
    sessionInactivityTimeout: number;
    jwtAccessTokenExpiresIn: JwtExpiresIn;
    logLevel: LogLevel;
    logDirectory: string;
    logRetentionWeeks: number;
}>;
