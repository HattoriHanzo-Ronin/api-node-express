import type Cache from "../utils/cache/cache.js";
import type FtpService from "../services/ftp-service.js";
import type FtpMapper from "../mappers/ftp-mapper.js";
import type SocketSessionsFacade from "../facades/socket-sessions-facade.js";
import type { MemoryCacheMap } from "./memory-cache.js";
import type { DirectoryHash } from "./directory-cache.js";
import type { FtpEntrySource } from "./ftp-mapper.js";
import type { FtpSessionUser } from "./ftp-connection-manager.js";
import type { ServerResponse } from "node:http";
import type { FtpDownloadStream, FtpSourceEntry } from "./default-ftp-service.js";
import type { UploadedFile } from "./middlewares.js";

export type FtpProgressStream = ServerResponse & { set?: (headers: Record<string, string>) => unknown };

export type FtpFacadeDependencies = {
    ftpService: FtpService<ServerResponse, FtpDownloadStream, UploadedFile, Buffer, FtpSourceEntry>;
    ftpMapper: FtpMapper<FtpSourceEntry>;
    memoryCache: Cache<MemoryCacheMap>;
    directoryCache: Cache<DirectoryHash>;
    socketSessionsFacade: SocketSessionsFacade;
};
export type FtpThumbnailSyncParams = { dir: string; entries: FtpEntrySource[]; authUser: FtpSessionUser };
export type FtpThumbnailQueueParams = {
    dir: string;
    names: string[];
    authUser: FtpSessionUser;
    thumbnailJobs?: Set<string>;
};
export type FtpThumbnailFetchParams = { dir: string; names: string[]; authUser: FtpSessionUser; jobKey: string };
export type FtpWatchDirectoryParams = { dir: string; authUser: FtpSessionUser } & (
    { entries: FtpEntrySource[]; hash?: string } | { entries?: FtpEntrySource[]; hash: string }
);
export type FtpNotificationParams = { authUser: FtpSessionUser; dir: string; version: string };
export type FtpProgressParams = { stream: FtpProgressStream; progress: object };
