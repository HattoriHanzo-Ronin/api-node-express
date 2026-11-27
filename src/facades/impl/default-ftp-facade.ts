import type { ServerResponse } from "node:http";
import type { UploadedFile } from "../../types/middlewares/middlewares.js";
import type { FtpDownloadStream } from "../../types/ftp/default-ftp-service.js";
import type FtpFacade from "../ftp-facade.js";
import type { FtpEntrySource } from "../../types/ftp/ftp-mapper.js";
import type { FtpMediaParams, FtpDirectoryParams } from "../../types/ftp/ftp-service.js";
import type {
    FtpFacadeCreateUploadParams,
    FtpFacadeDirectoryParams,
    FtpFacadeDownloadParams,
    FtpFacadeEntriesParams,
    FtpFacadeMakeDirParams,
    FtpFacadeMoveParams,
    FtpDirectoryResponse,
    FtpMoveResponse,
    FtpFacadeRenameParams,
    FtpFacadeTransferParams,
    FtpFacadeUploadParams,
    FtpThumbnailParams
} from "../../types/ftp/ftp-facade.js";
import type {
    FtpFacadeDependencies,
    FtpNotificationParams,
    FtpThumbnailFetchParams,
    FtpThumbnailQueueParams,
    FtpThumbnailSyncParams,
    FtpWatchDirectoryParams
} from "../../types/ftp/default-ftp-facade.js";
import path from "node:path";
import { createHash } from "node:crypto";
import { FILE_TYPE, SOCKET_ENTITY } from "../../config/constants.js";
import { API_ERROR } from "../../config/errors.js";
import { LOG_EVENT } from "../../config/log-events.js";
import ApiError from "../../utils/error/api-error.js";
import Logger from "../../utils/logger/logger.js";
import { ENV } from "../../config/environment.js";

const { sftpOperationCompleted, backgroundFailed } = LOG_EVENT;

const { dir: directoryType } = FILE_TYPE;
const { ftpDirectoryCheckTimeout } = ENV;

/**
 * Default FTP facade
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultFtpFacade implements FtpFacade<ServerResponse, FtpDownloadStream, UploadedFile, Buffer> {
    private static readonly LOGGER = Logger.getLogger(DefaultFtpFacade);
    private static readonly HASH_ALGORITHM = "sha256";
    private readonly thumbnailJobs = new Map<string, Set<string>>();
    private readonly watchedDirectories = new Set<string>();

    constructor(private readonly dependencies: FtpFacadeDependencies) {}

    async dir({ dir, authUser, thumbnail }: FtpFacadeDirectoryParams) {
        const source = await this.dependencies.ftpService.dir({ dir, authUser, thumbnail });
        const result = this.dependencies.ftpMapper.entriesFromSource(source);
        this.syncThumbnails({ dir, entries: result, authUser });
        const hash = await this.watchDirectory({ dir, authUser, entries: result });
        return { hash, data: this.dependencies.ftpMapper.entriesToDomain(result) };
    }

    async streamMedia({ id, range, method, stream }: FtpMediaParams<ServerResponse>) {
        await this.dependencies.ftpService.streamMedia({ id, range, method, stream });
    }

    async getThumbnail({ dir, name, authUser }: FtpThumbnailParams) {
        let bufferMap = this.dependencies.memoryCache.get(authUser.id, dir);
        if (!bufferMap) {
            await this.dir({ dir, authUser, thumbnail: true });
            bufferMap = this.dependencies.memoryCache.get(authUser.id, dir);
        }

        const thumbnail = bufferMap?.get(name);
        const thumbnailJobs = this.thumbnailJobs.get(DefaultFtpFacade.getDirectoryKey(authUser.id, dir));
        ApiError.handle([
            {
                condition: thumbnail === undefined && Boolean(thumbnailJobs?.has(name)),
                message: "La miniatura se está generando",
                status: 404,
                apiError: API_ERROR.ftpThumbnailPending
            }
        ]);
        return thumbnail ?? null;
    }

    async makeDir({ dir, name, authUser }: FtpFacadeMakeDirParams) {
        await this.dependencies.ftpService.makeDir({ dir, name, authUser });
        const result = await this.dir({ dir, authUser });
        this.notify({ authUser, dir, version: result.hash });
        return result;
    }

    async move({ dir, entries, destination, authUser }: FtpFacadeMoveParams) {
        const started = performance.now();
        let result!: FtpMoveResponse;
        try {
            await this.dependencies.ftpService.move({
                dir,
                entries,
                destination,
                authUser,
                onEntry: async (entry, newName) => {
                    if (entry.type === directoryType) {
                        await this.moveCachedDirectory(
                            authUser.id,
                            path.posix.join(dir, entry.name),
                            path.posix.join(destination, newName)
                        );
                    }
                },
                onComplete: async () => {
                    this.clearDirectoryCache(authUser.id, dir);
                    this.clearDirectoryCache(authUser.id, destination);
                    const [origin, target] = await Promise.all([
                        this.dir({ dir, authUser }),
                        this.dir({ dir: destination, authUser })
                    ]);
                    this.notify({ authUser, dir, version: origin.hash });
                    this.notify({ authUser, dir: destination, version: target.hash });
                    result = { origin, destination: target };
                }
            });
            DefaultFtpFacade.LOGGER.info({
                event: sftpOperationCompleted,
                message: "SFTP operation completed",
                context: `User: ${authUser.id}\nOperation: move\nDuration: ${performance.now() - started} ms`
            });
            return result;
        } catch (error) {
            this.clearDirectoryCache(authUser.id, dir);
            this.clearDirectoryCache(authUser.id, destination);
            throw error;
        }
    }

    async rename({ dir, entry, newName, authUser }: FtpFacadeRenameParams) {
        const renamedEntry = await this.dependencies.ftpService.rename({ dir, entry, newName, authUser });
        if (entry.type === directoryType) {
            await this.moveCachedDirectory(
                authUser.id,
                path.posix.join(dir, entry.name),
                path.posix.join(dir, renamedEntry.name)
            );
        }

        const result = await this.dir({ dir, authUser });
        this.notify({ authUser, dir, version: result.hash });
        return result;
    }

    async createUpload({ dir, entries, authUser }: FtpFacadeCreateUploadParams) {
        return this.dependencies.ftpService.createUpload({ dir, entries, authUser });
    }

    async uploadEntry({ id, entryPath, offset, file, authUser }: FtpFacadeUploadParams<UploadedFile>) {
        return this.dependencies.ftpService.upload({ id, entryPath, offset, file, authUser });
    }

    async completeUpload({ id, authUser }: FtpFacadeTransferParams) {
        const result = await this.dependencies.ftpService.completeUpload({
            id,
            authUser,
            onComplete: async ({ dir }: Pick<FtpDirectoryParams, "dir">) => {
                const result = await this.dir({ dir, authUser });
                this.notify({ authUser, dir, version: result.hash });
                return result;
            }
        });
        return result;
    }

    async cancelTransfer({ id, authUser }: FtpFacadeTransferParams) {
        await this.dependencies.ftpService.cancelTransfer({ id, authUser });
    }

    async createDownload({ dir, entries, authUser }: FtpFacadeEntriesParams) {
        return this.dependencies.ftpService.createDownload({ dir, entries, authUser });
    }

    async downloadEntry({ id, entryPath, offset, authUser, stream }: FtpFacadeDownloadParams<FtpDownloadStream>) {
        await this.dependencies.ftpService.download({ id, entryPath, offset, authUser, stream });
    }

    async delete({ dir, entries, authUser }: FtpFacadeEntriesParams) {
        const started = performance.now();
        let result!: FtpDirectoryResponse;
        try {
            await this.dependencies.ftpService.delete({
                dir,
                entries,
                authUser,
                onEntry: async (entry) => {
                    if (entry.type === directoryType) {
                        this.clearDirectoryCache(authUser.id, path.posix.join(dir, entry.name));
                    }
                },
                onComplete: async () => {
                    this.clearDirectoryCache(authUser.id, dir);
                    result = await this.dir({ dir, authUser });
                    this.notify({ authUser, dir, version: result.hash });
                }
            });
            DefaultFtpFacade.LOGGER.info({
                event: sftpOperationCompleted,
                message: "SFTP operation completed",
                context: `User: ${authUser.id}\nOperation: delete\nDuration: ${performance.now() - started} ms`
            });
            return result;
        } catch (error) {
            this.clearDirectoryCache(authUser.id, dir);
            throw error;
        }
    }

    private clearDirectoryCache(ownerId: string, dir: string): void {
        this.dependencies.memoryCache.delete(ownerId, dir);
        this.dependencies.directoryCache.delete(ownerId, dir);
        this.thumbnailJobs.delete(DefaultFtpFacade.getDirectoryKey(ownerId, dir));
    }

    private notify({ authUser, dir, version }: FtpNotificationParams): void {
        const relativeDir = dir === "." ? " " : dir;
        this.dependencies.socketSessionsFacade.notify({
            entity: SOCKET_ENTITY.ftp,
            data: { dir: relativeDir, version },
            ownerId: authUser.id
        });
    }

    private syncThumbnails({ dir, entries, authUser }: FtpThumbnailSyncParams): void {
        const names = entries.filter(({ supportsThumbnail }) => supportsThumbnail).map(({ name }) => name);
        const cachedBufferMap = this.dependencies.memoryCache.get(authUser.id, dir);
        const bufferMap = new Map(cachedBufferMap);
        const removedNames = new Set(bufferMap.keys());
        const missingNames = names.filter((name) => !removedNames.delete(name));
        for (const name of removedNames) {
            bufferMap.delete(name);
        }

        if (!cachedBufferMap || removedNames.size) {
            this.dependencies.memoryCache.set(authUser.id, dir, bufferMap);
        }

        const jobKey = DefaultFtpFacade.getDirectoryKey(authUser.id, dir);
        const thumbnailJobs = this.thumbnailJobs.get(jobKey) ?? new Set();
        const nameSet = new Set(names);
        for (const name of thumbnailJobs) {
            if (!nameSet.has(name)) {
                thumbnailJobs.delete(name);
            }
        }

        if (!thumbnailJobs.size) {
            this.thumbnailJobs.delete(jobKey);
        }

        this.queueThumbnails({ dir, names: missingNames, authUser, thumbnailJobs });
    }

    private queueThumbnails({ dir, names, authUser, thumbnailJobs = new Set() }: FtpThumbnailQueueParams): void {
        const pendingNames = names.filter((name) => !thumbnailJobs.has(name));
        if (!pendingNames.length) {
            return;
        }

        const jobKey = DefaultFtpFacade.getDirectoryKey(authUser.id, dir);
        pendingNames.forEach((name) => thumbnailJobs.add(name));
        this.thumbnailJobs.set(jobKey, thumbnailJobs);
        void this.getThumbnails({ dir, names: pendingNames, authUser, jobKey });
    }

    private async getThumbnails({ dir, names, authUser, jobKey }: FtpThumbnailFetchParams): Promise<void> {
        try {
            await this.dependencies.ftpService.getThumbnails({
                dir,
                names,
                authUser,
                callback: async ({ name, thumbnail }) => {
                    const thumbnailJobs = this.thumbnailJobs.get(jobKey);
                    if (!thumbnailJobs?.delete(name)) {
                        return;
                    }

                    const cachedBufferMap = this.dependencies.memoryCache.get(authUser.id, dir);
                    if (cachedBufferMap) {
                        const bufferMap = new Map(cachedBufferMap);
                        bufferMap.set(name, thumbnail);
                        this.dependencies.memoryCache.set(authUser.id, dir, bufferMap);
                    }

                    if (!thumbnailJobs.size) {
                        this.thumbnailJobs.delete(jobKey);
                    }
                }
            });
        } catch (error) {
            if (!(error instanceof ApiError)) {
                DefaultFtpFacade.LOGGER.error({
                    event: backgroundFailed,
                    message: "Thumbnail background task failed",
                    context: `User: ${authUser.id}`,
                    error
                });
            }
            const thumbnailJobs = this.thumbnailJobs.get(jobKey);
            names.forEach((name) => thumbnailJobs?.delete(name));
            if (!thumbnailJobs?.size) {
                this.thumbnailJobs.delete(jobKey);
            }
        }
    }

    private async watchDirectory({ dir, authUser, entries, hash }: FtpWatchDirectoryParams): Promise<string> {
        const ownerId = authUser.id;
        const watcherKey = DefaultFtpFacade.getDirectoryKey(ownerId, dir);
        const directoryHash = hash ?? DefaultFtpFacade.hashDirectory(entries!);
        this.dependencies.directoryCache.set(ownerId, dir, { hash: directoryHash });
        if (!this.watchedDirectories.has(watcherKey)) {
            this.watchedDirectories.add(watcherKey);
            setTimeout(() => this.checkDirectory(ownerId, dir), ftpDirectoryCheckTimeout);
        }

        return directoryHash;
    }

    private async checkDirectory(ownerId: string, dir: string): Promise<void> {
        const cachedDirectory = this.dependencies.directoryCache.get(ownerId, dir);
        if (!cachedDirectory) {
            this.watchedDirectories.delete(DefaultFtpFacade.getDirectoryKey(ownerId, dir));
            return;
        }

        try {
            const source = await this.dependencies.ftpService.dir({
                dir,
                authUser: { id: ownerId },
                watcher: true
            });
            if (!source) {
                const sessionActive = this.dependencies.ftpService.isSessionActive({ ownerId });
                if (!sessionActive && this.dependencies.directoryCache.get(ownerId, dir) === cachedDirectory) {
                    this.dependencies.directoryCache.delete(ownerId, dir);
                }
            }
            if (source && this.dependencies.directoryCache.get(ownerId, dir) === cachedDirectory) {
                const entries = this.dependencies.ftpMapper.entriesFromSource(source);
                const hash = DefaultFtpFacade.hashDirectory(entries);
                if (hash !== cachedDirectory.hash) {
                    this.dependencies.directoryCache.set(ownerId, dir, { ...cachedDirectory, hash });
                    this.notify({ authUser: { id: ownerId }, dir, version: hash });
                }
            }
        } catch (error) {
            if (!(error instanceof ApiError)) {
                DefaultFtpFacade.LOGGER.warn({
                    event: backgroundFailed,
                    message: "Directory watcher failed",
                    context: `User: ${ownerId}`,
                    error
                });
            }
        }

        if (this.dependencies.directoryCache.has(ownerId, dir)) {
            setTimeout(() => this.checkDirectory(ownerId, dir), ftpDirectoryCheckTimeout);
            return;
        }

        this.watchedDirectories.delete(DefaultFtpFacade.getDirectoryKey(ownerId, dir));
    }

    private async moveCachedDirectory(ownerId: string, sourceKey: string, destinationKey: string): Promise<void> {
        const bufferMap = this.dependencies.memoryCache.get(ownerId, sourceKey);
        const directory = this.dependencies.directoryCache.get(ownerId, sourceKey);
        const sourceJobKey = DefaultFtpFacade.getDirectoryKey(ownerId, sourceKey);
        const names = [...(this.thumbnailJobs.get(sourceJobKey) ?? [])];
        this.dependencies.memoryCache.delete(ownerId, sourceKey);
        this.dependencies.directoryCache.delete(ownerId, sourceKey);
        this.thumbnailJobs.delete(sourceJobKey);
        if (bufferMap !== undefined) {
            this.dependencies.memoryCache.set(ownerId, destinationKey, bufferMap);
        }

        if (directory !== undefined) {
            await this.watchDirectory({
                dir: destinationKey,
                authUser: { id: ownerId },
                hash: directory.hash
            });

            if (names.length) {
                this.queueThumbnails({
                    dir: destinationKey,
                    names,
                    authUser: { id: ownerId }
                });
            }
        }
    }

    private static getDirectoryKey(ownerId: string, dir: string): string {
        return JSON.stringify([ownerId, dir]);
    }

    private static hashDirectory(entries: FtpEntrySource[]): string {
        const source = entries
            .map(({ name, size, modifyTime, type }) => `${name}:${size}:${modifyTime}:${type}`)
            .sort()
            .join("|");
        return createHash(DefaultFtpFacade.HASH_ALGORITHM).update(source).digest("hex");
    }
}
