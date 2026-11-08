import type { VerifiedAccessToken } from "../auth/auth-facade.js";
import type { UserId } from "../users/users-model.js";

export type FtpSessionUser = VerifiedAccessToken | UserId;

export type FtpPoolType = "internal" | "read" | "write";

export type Release = () => void;

export type FtpLockRequest = {
    paths: string[];
    sharedPaths: string[];
    treePaths: string[];
};

export type ExecuteFtpOperationParams<Client, Result> = {
    authUser: FtpSessionUser;
    pool: FtpPoolType;
    paths?: string[];
    sharedPaths?: string[];
    treePaths?: string[];
    skipLocked?: boolean;
    transfer?: boolean;
    callback: (params: { client: Client }) => Promise<Result>;
};

export type ExecuteRequiredFtpOperationParams<Client, Result> = ExecuteFtpOperationParams<Client, Result> & {
    pool: "read" | "write";
    skipLocked?: false;
};

export type FtpLockTransferParams = {
    authUser: FtpSessionUser;
    paths: string[];
    sharedPaths: string[];
    treePaths: string[];
};
