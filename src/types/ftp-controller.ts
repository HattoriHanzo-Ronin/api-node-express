import type { RequestHandler } from "express";
import type FtpFacade from "../facades/ftp-facade.js";
import type { FtpProgressStream } from "./default-ftp-facade.js";
import type { FtpDownloadStream } from "./default-ftp-service.js";
import type { UploadedFile } from "./middlewares.js";
import type { ServerResponse } from "node:http";
import type { FtpDomainEntry } from "./ftp-mapper.js";
import type { FtpDownloadSession, FtpUploadSession } from "./ftp-service.js";

export type FtpControllerDependencies = {
    ftpFacade: FtpFacade<ServerResponse, FtpProgressStream, FtpDownloadStream, UploadedFile, Buffer>;
};
export type FtpDirHandler = RequestHandler<Record<string, never>, FtpDomainEntry[], unknown>;
export type FtpStreamMediaHandler = RequestHandler<{ id: string }, unknown, unknown>;
export type FtpThumbnailHandler = RequestHandler<{ name: string }, unknown, unknown>;
export type FtpMakeDirHandler = RequestHandler<Record<string, never>, FtpDomainEntry[], unknown>;
export type FtpMoveHandler = RequestHandler<Record<string, never>, unknown, unknown>;
export type FtpRenameHandler = RequestHandler<Record<string, never>, FtpDomainEntry[], unknown>;
export type FtpCreateUploadHandler = RequestHandler<Record<string, never>, FtpUploadSession, unknown>;
export type FtpUploadEntryHandler = RequestHandler<{ id: string }, { nextOffset: number }, unknown>;
export type FtpCompleteUploadHandler = RequestHandler<{ id: string }, FtpDomainEntry[], unknown>;
export type FtpCancelTransferHandler = RequestHandler<{ id: string }, unknown, unknown>;
export type FtpCreateDownloadHandler = RequestHandler<Record<string, never>, FtpDownloadSession, unknown>;
export type FtpDownloadEntryHandler = RequestHandler<{ id: string }, unknown, unknown>;
export type FtpDeleteHandler = RequestHandler<Record<string, never>, unknown, unknown>;
