import type SftpClient from "ssh2-sftp-client";
import type { FtpLockRequest, FtpPoolType, Release } from "./ftp-connection-manager.js";

export type FtpConnection = {
    type: FtpPoolType;
    busy: boolean;
    lastUsed: number;
    clientPromise: Promise<SftpClient>;
};

export type FtpConnectionPending = {
    resolve: (connection: FtpConnection) => void;
    reject: (reason?: unknown) => void;
    scaleTimeout?: NodeJS.Timeout;
};

export type FtpPool = {
    connections: FtpConnection[];
    queue: FtpConnectionPending[];
};

export type FtpPools = Record<FtpPoolType, FtpPool>;

export type FtpPoolConfiguration = Readonly<Record<FtpPoolType, { min: number; max: number }>>;

export type FtpTransferPending = {
    resolve: (release: Release) => void;
    reject: (reason?: unknown) => void;
};

export type FtpCapacityPending = {
    resolve: Release;
    reject: (reason?: unknown) => void;
};

export type FtpPathLock = {
    exclusive: boolean;
    shared: number;
};

export type FtpLockPending = FtpLockRequest & {
    resolve: (release: Release) => void;
    reject: (reason?: unknown) => void;
};

export type FtpSession = {
    ownerId: string;
    lastActivity: number;
    pools: FtpPools;
    lockedPaths: Map<string, FtpPathLock>;
    lockedTrees: Set<string>;
    transferLocks: number;
    lockQueue: FtpLockPending[];
    closing: boolean;
    initializing: Promise<void>;
    expired?: boolean;
    idleTimeout?: NodeJS.Timeout;
};

/**
 * Pooled FTP connection manager dependencies
 *
 * @author HattoriHanzo-Ronin
 */
export type FtpConnectionManagerDependencies = {
    createClient?: (params: { ownerId: string }) => Promise<SftpClient>;
    closeClient?: (params: { client: SftpClient }) => Promise<void>;
};

export type FtpEvictionCandidate =
    | { session: FtpSession; type: FtpPoolType; connection: FtpConnection }
    | { session: FtpSession };
