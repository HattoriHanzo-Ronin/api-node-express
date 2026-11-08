import type SftpClient from "ssh2-sftp-client";
import type { Readable, Transform, Writable } from "node:stream";
import type { FTP_TRANSFER_TYPE } from "../../config/constants.js";
import type FtpConnectionManager from "../../utils/connection/ftp/manager/ftp-connection-manager.js";
import type { FtpSessionUser, Release } from "./ftp-connection-manager.js";
import type { FtpCompleteUploadParams, FtpDownloadManifestEntry, FtpEntry, FtpTransferEntry } from "./ftp-service.js";

export type FtpSourceEntry = Awaited<ReturnType<SftpClient["list"]>>[number];
export type FtpDownloadStream = Writable & { setHeader?: (name: string, value: number) => unknown };
export type FtpServiceDependencies<Client> = { ftpConnectionManager: FtpConnectionManager<Client> };
export type FtpUploadDirectoryEntry = FtpTransferEntry & { type: "DIR"; uploaded: true };
export type FtpUploadFileEntry = FtpTransferEntry & {
    type: "FILE";
    uploaded: boolean;
    uploading: boolean;
    receivedBytes: number;
    remotePath?: string;
};
export type FtpUploadEntry = FtpUploadDirectoryEntry | FtpUploadFileEntry;
export type FtpUploadState = {
    type: (typeof FTP_TRANSFER_TYPE)["upload"];
    dir: string;
    ownerId: string;
    entries: Map<string, FtpUploadEntry>;
    createdDirs: Set<string>;
    fileLocks: Release[];
    activeStreams: Set<Readable | Writable>;
    protectedDirs: string[];
    timeout?: NodeJS.Timeout;
    releaseLocks?: Release;
    releaseEntryLocks?: Release;
};
export type FtpDownloadState = {
    type: (typeof FTP_TRANSFER_TYPE)["download"];
    dir: string;
    ownerId: string;
    timeout: NodeJS.Timeout;
    releaseLocks?: Release;
    entries: FtpDownloadManifestEntry[];
    completedEntries: Set<string>;
    activeDownloads: number;
    activeStreams: Set<Readable | Writable>;
};
export type FtpCompleteUploadInput = Omit<FtpCompleteUploadParams<unknown>, "onComplete"> &
    Partial<Pick<FtpCompleteUploadParams<unknown>, "onComplete">>;
export type FtpTransferCleanupParams = { session?: FtpTransferState };
export type FtpSizeValidatorParams = { expectedSize: number };
export type FtpTransferState = FtpUploadState | FtpDownloadState;
export type FtpMediaState = { size: number; createReadStream: (params: { start: number; end: number }) => Readable };
export type FtpChunkCounter = Transform & { size: number };

export type FtpThumbnailParams = { client: SftpClient; remotePath: string; size: number };
export type FtpDownloadEntriesParams = {
    client: SftpClient;
    remoteDir: string;
    entries: FtpEntry[] | FtpSourceEntry[];
    relativeDir?: string;
};
export type FtpDownloadEntry = { name: string; remotePath: string } & (
    { type: "DIR" } | { type: "FILE"; size: number }
);
export type FtpRangeParams = { source?: string; size: number };
export type FtpRange = { start: number; end: number; partial: boolean };
export type FtpAvailableNameParams = { name: string; list: Array<{ name: string }> };
export type FtpChunkCounterParams = { entry: FtpUploadEntry; offset: number; maxSize: number };
export type FtpTransferLookup = {
    id: string;
    ownerId: string;
    type?: (typeof FTP_TRANSFER_TYPE)[keyof typeof FTP_TRANSFER_TYPE];
};
export type FtpAvailablePathParams = {
    dir: string;
    name: string;
    reservedNames?: string[];
    protectedPath?: boolean;
    authUser: FtpSessionUser;
};
export type FtpRenameAvailableParams = { client: SftpClient; sourcePath: string; destinationPath: string };
export type FtpMissingDirectoriesParams = { client: SftpClient; remoteDir: string; directories: Set<string> };
