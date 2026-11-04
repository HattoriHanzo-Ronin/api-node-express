import type { AuthenticatedUser } from "./users-facade.js";

export type FtpPoolType = "internal" | "read" | "write";

export type Release = () => void;

export type FtpLockRequest = {
    paths: string[];
    sharedPaths: string[];
    treePaths: string[];
};

export type ExecuteFtpOperationParams<Client, Result> = {
    authUser: AuthenticatedUser;
    pool: FtpPoolType;
    paths?: string[];
    sharedPaths?: string[];
    treePaths?: string[];
    skipLocked?: boolean;
    transfer?: boolean;
    callback: (params: { client: Client }) => Promise<Result>;
};

export type FtpLockTransferParams = {
    authUser: AuthenticatedUser;
    paths: string[];
    sharedPaths: string[];
    treePaths: string[];
};
