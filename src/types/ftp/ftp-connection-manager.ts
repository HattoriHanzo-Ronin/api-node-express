import type { VerifiedAccessToken } from "../auth/auth-facade.js";
import type { UserId } from "../users/users-model.js";

export type FtpSessionUser = VerifiedAccessToken | UserId;

export type FtpPoolType = "watcher" | "interactive" | "transfer";

export type Release = () => void;

export type FtpLockRequest = {
    paths: string[];
    sharedPaths: string[];
    treePaths: string[];
    sharedTreePaths: string[];
};

export type ExecuteFtpOperationParams<Client, Result> = {
    authUser: FtpSessionUser;
    pool: FtpPoolType;
    paths?: string[];
    sharedPaths?: string[];
    treePaths?: string[];
    skipLocked?: boolean;
    readOnly?: boolean;
    transfer?: boolean;
    callback: (params: { client: Client }) => Promise<Result>;
};

export type ExecuteRequiredFtpOperationParams<Client, Result> = ExecuteFtpOperationParams<Client, Result> & {
    pool: "interactive" | "transfer";
    skipLocked?: false;
};

export type FtpLockTransferParams = {
    authUser: FtpSessionUser;
    paths: string[];
    sharedPaths: string[];
    treePaths: string[];
    sharedTreePaths?: string[];
};
