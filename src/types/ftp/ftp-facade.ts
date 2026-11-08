import type { AuthUserParams } from "../auth/auth-facade.js";
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

export type FtpFacadeDirectoryParams = Omit<FtpDirectoryParams, "authUser"> & AuthUserParams;
export type FtpDirectoryResponse = { hash: string; data: FtpDomainEntry[] };
export type FtpThumbnailParams = FtpFacadeDirectoryParams & { name: string };
export type FtpFacadeMakeDirParams = Omit<FtpMakeDirParams, "authUser"> & AuthUserParams;
export type FtpFacadeMoveParams<Stream> = Omit<FtpMoveParams, "authUser" | "onEntry" | "onComplete"> &
    AuthUserParams & { stream: Stream };
export type FtpFacadeRenameParams = Omit<FtpRenameParams, "authUser"> & AuthUserParams;
export type FtpFacadeCreateUploadParams = Omit<FtpCreateUploadParams, "authUser"> & AuthUserParams;
export type FtpFacadeUploadParams<File> = Omit<FtpUploadParams<File>, "authUser"> & AuthUserParams;
export type FtpFacadeTransferParams = Omit<FtpTransferParams, "authUser"> & AuthUserParams;
export type FtpFacadeEntriesParams = Omit<FtpEntriesParams, "authUser"> & AuthUserParams;
export type FtpFacadeDownloadParams<Stream> = Omit<FtpDownloadParams<Stream>, "authUser"> & AuthUserParams;
export type FtpFacadeDeleteParams<Stream> = FtpFacadeEntriesParams & { stream: Stream };
