import type { JwtExpiresIn } from "./jwt-provider.js";

export type ProtectedService = "ftp" | "socket";

export type ProtectedUserReservations = Readonly<Partial<Record<ProtectedService, number>>>;

export type ProtectedUsers = Readonly<Record<string, ProtectedUserReservations>>;

export type Environment = Readonly<{
    port: number;
    thumbnailGeneratorUrl: string;
    routerCpanelServiceUrl: string;
    dbHost: string;
    dbPort: number;
    dbUser: string;
    dbName: string;
    ftpHost: string;
    ftpPort: number;
    ftpMaxConnections: number;
    ftpMaxTransfers: number;
    ftpIdleTimeout: number;
    ftpScaleWait: number;
    protectedUsers: ProtectedUsers;
    ftpInternalPoolMin: number;
    ftpInternalPoolMax: number;
    ftpReadPoolMin: number;
    ftpReadPoolMax: number;
    ftpWritePoolMin: number;
    ftpWritePoolMax: number;
    ftpMediaSessionTimeout: number;
    ftpTransferSessionTimeout: number;
    ftpMaxUploadChunkSize: number;
    ftpMaxThumbnailSize: number;
    ftpDirectoryCheckTimeout: number;
    memoryCacheMaxSize: number;
    memoryCacheMaxSizePerOwner: number;
    memoryCacheInactivityTimeout: number;
    directoryCacheInactivityTimeout: number;
    jwtAccessTokenExpiresIn: JwtExpiresIn;
    jwtRefreshTokenExpiresIn: JwtExpiresIn;
    socketMaxConnections: number;
    socketMaxConnectionsPerUser: number;
    socketSessionInactivityTimeout: number;
    socketPingTimeout: number;
    chromePath: string;
}>;
