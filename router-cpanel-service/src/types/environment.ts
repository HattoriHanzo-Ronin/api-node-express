import type { JwtExpiresIn } from "./jwt-provider.js";

export type Environment = Readonly<{
    port: number;
    publicUrl: string | undefined;
    chromePath: string | undefined;
    displayBase: number;
    vncPortBase: number;
    maxActiveUsers: number;
    maxSessionsPerUser: number;
    maxVncConnectionsPerSession: number;
    sessionInactivityTimeout: number;
    jwtAccessTokenExpiresIn: JwtExpiresIn | undefined;
}>;
