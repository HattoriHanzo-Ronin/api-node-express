import type { AuthAccessTokenPayload } from "./auth.js";
import type { FtpDomainEntry } from "./ftp-mapper.js";
import type {
    FtpCreateUploadParams,
    FtpDirectoryParams,
    FtpDownloadParams,
    FtpEntriesParams,
    FtpMakeDirParams,
    FtpMoveParams,
    FtpRenameParams,
    FtpTransferParams,
    FtpUploadParams
} from "./ftp-service.js";

export type FtpFacadeDirectoryParams = Omit<FtpDirectoryParams, "authUser"> & { authUser: AuthAccessTokenPayload };
export type FtpDirectoryResponse = { hash: string; data: FtpDomainEntry[] };
export type FtpThumbnailParams = FtpFacadeDirectoryParams & { name: string };
export type FtpFacadeMakeDirParams = Omit<FtpMakeDirParams, "authUser"> & { authUser: AuthAccessTokenPayload };
export type FtpFacadeMoveParams<Stream> = Omit<FtpMoveParams, "authUser" | "onEntry" | "onComplete"> & {
    authUser: AuthAccessTokenPayload;
    stream: Stream;
};
export type FtpFacadeRenameParams = Omit<FtpRenameParams, "authUser"> & { authUser: AuthAccessTokenPayload };
export type FtpFacadeCreateUploadParams = Omit<FtpCreateUploadParams, "authUser"> & {
    authUser: AuthAccessTokenPayload;
};
export type FtpFacadeUploadParams<File> = Omit<FtpUploadParams<File>, "authUser"> & {
    authUser: AuthAccessTokenPayload;
};
export type FtpFacadeTransferParams = Omit<FtpTransferParams, "authUser"> & { authUser: AuthAccessTokenPayload };
export type FtpFacadeEntriesParams = Omit<FtpEntriesParams, "authUser"> & { authUser: AuthAccessTokenPayload };
export type FtpFacadeDownloadParams<Stream> = Omit<FtpDownloadParams<Stream>, "authUser"> & {
    authUser: AuthAccessTokenPayload;
};
export type FtpFacadeDeleteParams<Stream> = FtpFacadeEntriesParams & { stream: Stream };
