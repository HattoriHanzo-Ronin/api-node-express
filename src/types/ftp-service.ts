import type { FILE_TYPE } from "../config/constants.js";
import type { FtpSessionUser } from "./ftp-connection-manager.js";

export type FtpEntryType = (typeof FILE_TYPE)[keyof typeof FILE_TYPE];
export type FtpEntry = { name: string; type: FtpEntryType };

export type FtpAuthParams = { authUser: FtpSessionUser };
export type FtpDirectoryParams = FtpAuthParams & { dir: string };
export type FtpDirectoryListParams = FtpDirectoryParams & { internal?: boolean };
export type FtpOwnerParams = { ownerId: string };
export type FtpThumbnailResult<Thumbnail> = { name: string; thumbnail: Thumbnail | null };
export type FtpThumbnailsParams<Thumbnail> = FtpDirectoryParams & {
    names: string[];
    callback: (result: FtpThumbnailResult<Thumbnail>) => Promise<void>;
};
export type FtpMediaParams<Stream> = { id: string; range?: string; method: string; stream: Stream };
export type FtpMakeDirParams = FtpDirectoryParams & { name: string };
export type FtpEntriesParams = FtpDirectoryParams & { entries: FtpEntry[] };
export type FtpMoveParams = FtpEntriesParams & {
    destination: string;
    onEntry: (entry: FtpEntry, newName: string) => Promise<void>;
    onComplete?: () => Promise<void>;
};
export type FtpRenameParams = FtpDirectoryParams & { entry: FtpEntry; newName: string };
export type FtpTransferEntry = { path: string; type: FtpEntryType; size?: number };
export type FtpCreateUploadParams = FtpDirectoryParams & { entries: FtpTransferEntry[] };
export type FtpTransferParams = FtpAuthParams & { id: string };
export type FtpCompleteUploadParams<Result> = FtpTransferParams & {
    onComplete: (params: Pick<FtpDirectoryParams, "dir">) => Promise<Result>;
};
export type FtpTransferFileParams = FtpTransferParams & { entryPath: string; offset?: number };
export type FtpUploadParams<File> = FtpTransferFileParams & { file?: File };
export type FtpDownloadParams<Stream> = FtpTransferFileParams & { stream: Stream };
export type FtpDeleteParams = FtpEntriesParams & {
    onEntry: (entry: FtpEntry) => Promise<void>;
    onComplete?: () => Promise<void>;
};
export type FtpUploadSession = { id: string; entries: FtpTransferEntry[] };
export type FtpDownloadFileEntry = { path: string; type: "FILE"; size: number };
export type FtpDownloadDirectoryEntry = { path: string; type: "DIR" };
export type FtpDownloadManifestEntry = FtpDownloadFileEntry | FtpDownloadDirectoryEntry;
export type FtpDownloadSession = { id: string; entries: FtpDownloadManifestEntry[]; totalBytes: number };
