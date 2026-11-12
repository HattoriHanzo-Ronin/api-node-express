import type { ServerResponse } from "node:http";
import type { UploadedFile } from "../../types/middlewares/middlewares.js";
import type { ApiErrorOptions } from "../../types/utils/api-error.js";
import type { Release } from "../../types/ftp/ftp-connection-manager.js";
import type SftpClient from "ssh2-sftp-client";
import type FtpService from "../ftp-service.js";
import type {
    FtpDownloadStream,
    FtpSourceEntry,
    FtpServiceDependencies,
    FtpCompleteUploadInput,
    FtpTransferCleanupParams,
    FtpSizeValidatorParams,
    FtpTransferState,
    FtpMediaState,
    FtpUploadState,
    FtpUploadEntry,
    FtpUploadFileEntry,
    FtpDownloadState,
    FtpChunkCounter,
    FtpThumbnailParams,
    FtpDownloadEntriesParams,
    FtpDownloadEntry,
    FtpRangeParams,
    FtpRange,
    FtpAvailableNameParams,
    FtpChunkCounterParams,
    FtpTransferLookup,
    FtpAvailablePathParams,
    FtpRenameAvailableParams,
    FtpMissingDirectoriesParams
} from "../../types/ftp/default-ftp-service.js";
import type {
    FtpCompleteUploadParams,
    FtpDirectoryParams,
    FtpDownloadFileEntry,
    FtpDownloadManifestEntry,
    FtpCreateUploadParams,
    FtpDeleteParams,
    FtpDirectoryListParams,
    FtpDownloadParams,
    FtpEntriesParams,
    FtpMakeDirParams,
    FtpMediaParams,
    FtpMoveParams,
    FtpOwnerParams,
    FtpRenameParams,
    FtpThumbnailsParams,
    FtpTransferParams,
    FtpUploadParams
} from "../../types/ftp/ftp-service.js";
import { randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { finished, pipeline } from "node:stream/promises";
import path from "node:path";
import ApiError from "../../utils/error/api-error.js";
import { FILE_TYPE, FTP_TRANSFER_TYPE } from "../../config/constants.js";
import { API_ERROR } from "../../config/errors.js";
import { ENV } from "../../config/environment.js";
import { LOG_EVENT } from "../../config/log-events.js";
import Logger from "../../utils/logger/logger.js";

const { backgroundFailed } = LOG_EVENT;

const {
    ftpMediaSessionTimeout,
    ftpTransferSessionTimeout,
    ftpMaxUploadChunkSize,
    ftpMaxThumbnailSize,
    thumbnailGeneratorUrl
} = ENV;
const { dir: dirType, file: fileType } = FILE_TYPE;
const {
    ftpUploadFailed,
    ftpUploadChunkTooLarge,
    ftpUploadSizeExceeded,
    ftpDownloadFailed,
    ftpDownloadStale,
    ftpDirFailed,
    ftpMkdirFailed,
    ftpMoveFailed,
    ftpRenameFailed,
    ftpDeleteFailed,
    ftpThumbnailFailed,
    ftpThumbnailTooLarge,
    ftpFileRequired
} = API_ERROR;

/**
 * Default FTP service
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultFtpService implements FtpService<
    ServerResponse,
    FtpDownloadStream,
    UploadedFile,
    Buffer,
    FtpSourceEntry
> {
    private static readonly LOGGER = Logger.getLogger(DefaultFtpService);
    private readonly ftpConnectionManager: FtpServiceDependencies<SftpClient>["ftpConnectionManager"];
    private readonly transferSessions = new Map<string, FtpTransferState>();
    private readonly mediaSessions = new Map<string, FtpMediaState>();

    constructor({ ftpConnectionManager }: FtpServiceDependencies<SftpClient>) {
        this.ftpConnectionManager = ftpConnectionManager;
    }

    isSessionActive({ ownerId }: FtpOwnerParams) {
        return this.ftpConnectionManager.isActive({ ownerId });
    }

    async dir(params: FtpDirectoryListParams & { watcher?: false }): Promise<FtpSourceEntry[]>;
    async dir(params: FtpDirectoryListParams): Promise<FtpSourceEntry[] | undefined>;
    async dir({ dir, authUser, watcher = false }: FtpDirectoryListParams): Promise<FtpSourceEntry[] | undefined> {
        try {
            return await this.ftpConnectionManager.execute({
                authUser,
                pool: watcher ? "watcher" : "interactive",
                readOnly: true,
                paths: [dir],
                skipLocked: watcher,
                callback: ({ client }) => client.list(dir)
            });
        } catch (err) {
            throw DefaultFtpService.ftpError({
                message: "Error al listar la carpeta",
                apiError: ftpDirFailed,
                cause: err
            });
        }
    }

    async getThumbnails({ dir, names, authUser, callback }: FtpThumbnailsParams<Buffer>) {
        try {
            return await this.ftpConnectionManager.execute({
                authUser,
                pool: "transfer",
                readOnly: true,
                transfer: true,
                paths: names.map((name) => path.posix.join(dir, name)),
                callback: async ({ client }) => {
                    await Promise.all(
                        names.map(async (name) => {
                            let thumbnail;
                            try {
                                const remotePath = path.posix.join(dir, name);
                                const { size } = await client.stat(remotePath);
                                thumbnail = await this.createThumbnail({ client, remotePath, size });
                            } catch (error) {
                                if (!(error instanceof ApiError)) {
                                    DefaultFtpService.LOGGER.warn({
                                        event: backgroundFailed,
                                        message: "Thumbnail generation failed",
                                        context: `User: ${authUser.id}`,
                                        error
                                    });
                                }

                                thumbnail = null;
                            }

                            await callback({ name, thumbnail });
                        })
                    );
                }
            });
        } catch (err) {
            throw DefaultFtpService.ftpError({
                message: "Error al generar las miniaturas",
                cause: err,
                apiError: ftpThumbnailFailed
            });
        }
    }

    async streamMedia({ id, range, method, stream }: FtpMediaParams<ServerResponse>) {
        const session = this.mediaSessions.get(id);
        if (!session) {
            stream.statusCode = 204;
            stream.end();
            return;
        }

        const { size, createReadStream } = session;
        const { start, end, partial } = DefaultFtpService.getRange({ source: range, size });
        if (start > end || start >= size) {
            stream.writeHead(416, { "Content-Range": `bytes */${size}` });
            stream.end();
            return;
        }

        const headers: Record<string, string | number> = {
            "Accept-Ranges": "bytes",
            "Content-Length": end - start + 1
        };
        if (partial) {
            headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
        }

        stream.writeHead(partial ? 206 : 200, headers);
        if (method === "HEAD") {
            stream.end();
            return;
        }

        const source = createReadStream({ start, end });
        let responseClosed = false;
        let sourceFailed = false;
        const onClose = () => {
            responseClosed = !stream.writableFinished;
        };
        const onSourceError = () => {
            if (!responseClosed) {
                sourceFailed = true;
            }
        };
        const onSourceClose = () => {
            if (!responseClosed && !source.readableEnded) {
                sourceFailed = true;
            }
        };
        stream.once("close", onClose);
        source.once("error", onSourceError);
        source.once("close", onSourceClose);
        try {
            await pipeline(source, stream);
        } catch (error) {
            if (
                responseClosed &&
                !sourceFailed &&
                error instanceof Error &&
                "code" in error &&
                error.code === "ERR_STREAM_PREMATURE_CLOSE"
            ) {
                return;
            }

            throw error;
        } finally {
            stream.off("close", onClose);
            source.off("error", onSourceError);
            source.off("close", onSourceClose);
        }
    }

    async makeDir({ dir, name, authUser }: FtpMakeDirParams) {
        try {
            let remotePath = await this.getAvailableRemotePath({ dir, name, authUser });
            while (true) {
                const collision = await this.ftpConnectionManager.execute({
                    authUser,
                    pool: "interactive",
                    paths: [remotePath],
                    callback: async ({ client }) => {
                        if (await client.exists(remotePath)) {
                            return true;
                        }

                        try {
                            const result = await client.mkdir(remotePath);
                            return result.endsWith(" already exists");
                        } catch (error) {
                            if (await client.exists(remotePath)) {
                                return true;
                            }

                            throw error;
                        }
                    }
                });
                if (!collision) {
                    return;
                }

                remotePath = await this.getAvailableRemotePath({ dir, name, authUser });
            }
        } catch (err) {
            throw DefaultFtpService.ftpError({
                message: "Error al crear la carpeta",
                apiError: ftpMkdirFailed,
                cause: err
            });
        }
    }

    async move({ dir, entries, destination, authUser, onEntry, onComplete = async () => {} }: FtpMoveParams) {
        let releaseSources;
        const releaseDestinations: Release[] = [];
        try {
            releaseSources = await this.ftpConnectionManager.lockTransfer({
                authUser,
                paths: entries.map((entry) => path.posix.join(dir, entry.name)),
                sharedPaths: [
                    ...DefaultFtpService.getParentPaths({ dir }),
                    ...DefaultFtpService.getParentPaths({ dir: destination })
                ],
                treePaths: entries
                    .filter((entry) => entry.type === dirType)
                    .map((entry) => path.posix.join(dir, entry.name))
            });
            const movedNames = [];
            for (const item of entries) {
                const sourcePath = path.posix.join(dir, item.name);
                let destinationPath = await this.getAvailableRemotePath({
                    dir: destination,
                    name: item.name,
                    reservedNames: movedNames,
                    authUser
                });
                while (true) {
                    const releaseDestination = await this.ftpConnectionManager.lockTransfer({
                        authUser,
                        paths: [destinationPath],
                        sharedPaths: [],
                        treePaths: item.type === dirType ? [destinationPath] : []
                    });
                    let collision;
                    try {
                        collision = await this.ftpConnectionManager.execute({
                            authUser,
                            pool: "transfer",
                            callback: ({ client }) =>
                                DefaultFtpService.renameAvailable({ client, sourcePath, destinationPath })
                        });
                    } catch (error) {
                        releaseDestination();
                        throw error;
                    }

                    if (!collision) {
                        releaseDestinations.push(releaseDestination);
                        break;
                    }

                    releaseDestination();
                    destinationPath = await this.getAvailableRemotePath({
                        dir: destination,
                        name: item.name,
                        reservedNames: movedNames,
                        authUser
                    });
                }

                const movedName = path.posix.basename(destinationPath);
                movedNames.push(movedName);
                await onEntry(item, movedName);
            }

            await onComplete();
        } catch (err) {
            throw DefaultFtpService.ftpError({
                message: "Error al mover los archivos",
                apiError: ftpMoveFailed,
                cause: err
            });
        } finally {
            releaseDestinations.forEach((release) => release());
            releaseSources?.();
        }
    }

    async rename({ dir, entry, newName, authUser }: FtpRenameParams) {
        try {
            const sourcePath = path.posix.join(dir, entry.name);
            let destinationPath = await this.getAvailableRemotePath({ dir, name: newName, authUser });
            while (
                await this.ftpConnectionManager.execute({
                    authUser,
                    pool: "interactive",
                    paths: [sourcePath, destinationPath],
                    treePaths: entry.type === dirType ? [sourcePath, destinationPath] : [],
                    callback: ({ client }) => DefaultFtpService.renameAvailable({ client, sourcePath, destinationPath })
                })
            ) {
                destinationPath = await this.getAvailableRemotePath({ dir, name: newName, authUser });
            }

            return { ...entry, name: path.posix.basename(destinationPath) };
        } catch (err) {
            throw DefaultFtpService.ftpError({ message: "Error al renombrar", apiError: ftpRenameFailed, cause: err });
        }
    }

    async createUpload({ dir, entries, authUser }: FtpCreateUploadParams) {
        const id = randomUUID();
        const session: FtpUploadState = {
            type: FTP_TRANSFER_TYPE.upload,
            dir,
            ownerId: authUser.id,
            entries: new Map(),
            createdDirs: new Set(),
            protectedDirs: [],
            fileLocks: [],
            activeStreams: new Set()
        };
        try {
            session.releaseLocks = await this.ftpConnectionManager.lockTransfer({
                authUser,
                paths: [],
                sharedPaths: DefaultFtpService.getParentPaths({ dir }),
                treePaths: []
            });
            const uploadSession = await this.ftpConnectionManager.execute({
                authUser,
                pool: "transfer",
                paths: [`\0upload:${dir}`],
                callback: async ({ client }) => {
                    await DefaultFtpService.trackMissingDirectories({
                        client,
                        remoteDir: dir,
                        directories: session.createdDirs
                    });
                    await client.mkdir(dir, true);
                    const list: Array<{ name: string }> = await client.list(dir);
                    const roots = new Map<string, string>();
                    const resolvedEntries = entries.map((entry) => {
                        const [root, ...rest] = entry.path.split("/");
                        let name = roots.get(root);
                        if (name === undefined) {
                            name = DefaultFtpService.getAvailableName({ name: root, list });
                            roots.set(root, name);
                            list.push({ name });
                        }

                        return { ...entry, path: path.posix.join(name, ...rest) };
                    });
                    session.protectedDirs = [
                        ...new Set(
                            resolvedEntries
                                .filter((entry) => entry.type === dirType || entry.path.includes("/"))
                                .map((entry) => path.posix.join(dir, entry.path.split("/")[0]))
                        )
                    ];
                    session.releaseEntryLocks = await this.ftpConnectionManager.lockTransfer({
                        authUser,
                        paths: [],
                        sharedPaths: [],
                        treePaths: session.protectedDirs
                    });
                    for (const entry of resolvedEntries.filter(({ type }) => type === dirType)) {
                        const remoteDir = path.posix.join(dir, entry.path);
                        await DefaultFtpService.trackMissingDirectories({
                            client,
                            remoteDir,
                            directories: session.createdDirs
                        });
                        await client.mkdir(remoteDir, true);
                    }

                    const sessionEntries: Array<[string, FtpUploadEntry]> = resolvedEntries.map((entry) => {
                        if (entry.type === dirType) {
                            return [entry.path, { ...entry, type: dirType, uploaded: true }];
                        }

                        return [
                            entry.path,
                            { ...entry, type: fileType, receivedBytes: 0, uploaded: false, uploading: false }
                        ];
                    });
                    const timeout = setTimeout(
                        () => void this.expireTransfer({ id }).catch(DefaultFtpService.logBackgroundFailure),
                        ftpTransferSessionTimeout
                    );
                    timeout.unref();
                    session.timeout = timeout;
                    session.entries = new Map(sessionEntries);
                    this.transferSessions.set(id, session);
                    return { id, entries: resolvedEntries };
                }
            });
            return uploadSession;
        } catch (err) {
            await this.cleanupTransfer({ session });
            throw DefaultFtpService.ftpError({
                message: "Error al preparar la subida",
                apiError: ftpUploadFailed,
                cause: err
            });
        }
    }

    async upload({ id, entryPath, offset = 0, file, authUser }: FtpUploadParams<UploadedFile>) {
        ApiError.handle([
            { condition: !file, message: "Debe proporcionar un archivo", status: 400, apiError: ftpFileRequired }
        ]);
        const session = this.getTransferSession({ id, type: FTP_TRANSFER_TYPE.upload, ownerId: authUser.id });
        const sourceEntry = session.entries.get(entryPath);
        ApiError.handle([
            {
                condition: !sourceEntry || sourceEntry.type !== fileType,
                message: "El archivo no pertenece a la subida",
                status: 400,
                apiError: ftpUploadFailed
            },
            {
                condition: Boolean(sourceEntry && sourceEntry.type === fileType && sourceEntry.uploading),
                message: "Ya se está subiendo un fragmento del archivo",
                status: 409,
                apiError: ftpUploadFailed
            },
            {
                condition: Boolean(
                    sourceEntry && sourceEntry.type === fileType && offset !== sourceEntry.receivedBytes
                ),
                message: `Offset no válido, se esperaba ${sourceEntry?.type === fileType ? sourceEntry.receivedBytes : undefined}`,
                status: 409,
                apiError: ftpUploadFailed
            }
        ]);
        const entry = sourceEntry as FtpUploadFileEntry;
        const uploadedFile = file!;
        let destination;
        entry.uploading = true;
        session.activeStreams.add(uploadedFile.stream);
        try {
            let remotePath =
                entry.remotePath ??
                (await this.getAvailableRemotePath({
                    dir: path.posix.join(session.dir, path.posix.dirname(entryPath)),
                    name: path.posix.basename(entryPath),
                    protectedPath: true,
                    authUser
                }));
            while (true) {
                const protectedByDirectory = session.protectedDirs.some(
                    (dir) => remotePath === dir || remotePath.startsWith(`${dir}/`)
                );
                const releaseFile =
                    !entry.remotePath && !protectedByDirectory
                        ? await this.ftpConnectionManager.lockTransfer({
                              authUser,
                              paths: [remotePath],
                              sharedPaths: [],
                              treePaths: []
                          })
                        : undefined;
                if (releaseFile) {
                    session.fileLocks.push(releaseFile);
                }

                const result = await this.ftpConnectionManager.execute({
                    authUser,
                    pool: "transfer",
                    transfer: true,
                    callback: async ({ client }) => {
                        if (!entry.remotePath) {
                            try {
                                // The SFTP implementation supports "wx", but its published types omit it
                                await client.put(Buffer.alloc(0), remotePath, {
                                    writeStreamOptions: { flags: "wx" }
                                } as unknown as Parameters<SftpClient["put"]>[2]);
                            } catch (error) {
                                if (await client.exists(remotePath)) {
                                    return { collision: true };
                                }

                                throw error;
                            }

                            entry.remotePath = remotePath;
                        }

                        destination = client.createWriteStream(entry.remotePath, { flags: "r+", start: offset });
                        session.activeStreams.add(destination);
                        const counter = DefaultFtpService.createChunkCounter({
                            entry,
                            offset,
                            maxSize: ftpMaxUploadChunkSize
                        });
                        await pipeline(uploadedFile.stream, counter, destination);
                        entry.receivedBytes = counter.size;
                        entry.uploaded = entry.size === undefined || entry.receivedBytes === entry.size;
                        return { nextOffset: entry.receivedBytes };
                    }
                });
                if (result && "nextOffset" in result && result.nextOffset !== undefined) {
                    return { nextOffset: result.nextOffset };
                }

                releaseFile?.();

                remotePath = await this.getAvailableRemotePath({
                    dir: path.posix.join(session.dir, path.posix.dirname(entryPath)),
                    name: path.posix.basename(entryPath),
                    protectedPath: true,
                    authUser
                });
            }
        } catch (err) {
            clearTimeout(session.timeout);
            this.transferSessions.delete(id);
            await this.cleanupTransfer({ session });
            throw DefaultFtpService.ftpError({
                message: "Error al subir los datos",
                apiError: ftpUploadFailed,
                cause: err
            });
        } finally {
            entry.uploading = false;
            session.activeStreams.delete(uploadedFile.stream);
            if (destination) {
                session.activeStreams.delete(destination);
            }
        }
    }

    async completeUpload(params: FtpTransferParams): Promise<{ dir: string }>;
    async completeUpload<Result>(params: FtpCompleteUploadParams<Result>): Promise<Result>;
    async completeUpload({
        id,
        authUser,
        onComplete = async ({ dir }) => ({ dir })
    }: FtpCompleteUploadInput): Promise<unknown> {
        const session = this.getTransferSession({ id, type: FTP_TRANSFER_TYPE.upload, ownerId: authUser.id });
        ApiError.handle([
            {
                condition: [...session.entries.values()].some(
                    (entry) => !entry.uploaded || (entry.type === fileType && entry.uploading)
                ),
                message: "La subida contiene archivos pendientes",
                status: 409,
                apiError: ftpUploadFailed
            }
        ]);
        clearTimeout(session.timeout);
        this.transferSessions.delete(id);
        try {
            return await onComplete({ dir: session.dir });
        } finally {
            session.fileLocks.forEach((release) => release());
            session.releaseEntryLocks?.();
            session.releaseLocks?.();
        }
    }

    async cancelTransfer({ id, authUser }: FtpTransferParams) {
        const session = this.getTransferSession({ id, ownerId: authUser.id });
        clearTimeout(session.timeout);
        this.transferSessions.delete(id);
        await this.cleanupTransfer({ session });
    }

    async createDownload({ dir, entries, authUser }: FtpEntriesParams) {
        const id = randomUUID();
        let releaseLocks: Release | undefined;
        try {
            releaseLocks = await this.ftpConnectionManager.lockTransfer({
                authUser,
                paths: [],
                sharedPaths: [
                    ...DefaultFtpService.getParentPaths({ dir }),
                    ...entries.map((entry) => path.posix.join(dir, entry.name))
                ],
                treePaths: [],
                sharedTreePaths: entries
                    .filter((entry) => entry.type === dirType)
                    .map((entry) => path.posix.join(dir, entry.name))
            });
            const downloadSession = await this.ftpConnectionManager.execute({
                authUser,
                pool: "transfer",
                readOnly: true,
                callback: async ({ client }) => {
                    const resolvedEntries: FtpDownloadManifestEntry[] = [];
                    let totalBytes = 0;
                    for await (const entry of DefaultFtpService.createDownloadEntries({
                        client,
                        remoteDir: dir,
                        entries
                    })) {
                        const resolvedEntry =
                            entry.type === fileType
                                ? { path: entry.name, type: entry.type, size: entry.size }
                                : { path: entry.name, type: entry.type };
                        totalBytes += entry.type === fileType ? entry.size : 0;
                        ApiError.handle([
                            {
                                condition: !Number.isSafeInteger(totalBytes),
                                message: "El tamaño total de la descarga supera el máximo permitido",
                                status: 400,
                                apiError: ftpDownloadFailed
                            }
                        ]);
                        resolvedEntries.push(resolvedEntry);
                    }

                    const timeout = setTimeout(
                        () => void this.expireTransfer({ id }).catch(DefaultFtpService.logBackgroundFailure),
                        ftpTransferSessionTimeout
                    );
                    timeout.unref();
                    const session: FtpDownloadState = {
                        type: FTP_TRANSFER_TYPE.download,
                        dir,
                        ownerId: authUser.id,
                        timeout,
                        releaseLocks,
                        entries: resolvedEntries,
                        completedEntries: new Set(),
                        activeDownloads: 0,
                        activeStreams: new Set()
                    };
                    this.transferSessions.set(id, session);
                    if (!resolvedEntries.some((entry) => entry.type === fileType)) {
                        releaseLocks!();
                        session.releaseLocks = undefined;
                    }

                    return { id, totalBytes, entries: resolvedEntries };
                }
            });
            return downloadSession;
        } catch (err) {
            releaseLocks?.();
            throw DefaultFtpService.ftpError({
                message: "Error al preparar la descarga",
                apiError: ftpDownloadFailed,
                cause: err
            });
        }
    }

    async download({ id, entryPath, offset = 0, authUser, stream }: FtpDownloadParams<FtpDownloadStream>) {
        const session = this.getTransferSession({ id, type: FTP_TRANSFER_TYPE.download, ownerId: authUser.id });
        const sourceEntry = session.entries.find(
            (entry): entry is FtpDownloadFileEntry => entry.path === entryPath && entry.type === fileType
        );
        ApiError.handle([
            {
                condition: !sourceEntry,
                message: "El archivo no pertenece a la descarga",
                status: 400,
                apiError: ftpDownloadFailed
            },
            {
                condition: Boolean(sourceEntry && offset > sourceEntry.size),
                message: "El offset supera el tamaño del archivo",
                status: 416,
                apiError: ftpDownloadFailed
            }
        ]);
        const entry = sourceEntry!;
        let source;
        session.activeDownloads += 1;
        try {
            await this.ftpConnectionManager.execute({
                authUser,
                pool: "transfer",
                readOnly: true,
                transfer: true,
                paths: session.releaseLocks ? [] : [path.posix.join(session.dir, entryPath)],
                callback: async ({ client }) => {
                    const remotePath = path.posix.join(session.dir, entryPath);
                    let size;
                    try {
                        ({ size } = await client.stat(remotePath));
                    } catch (error) {
                        throw DefaultFtpService.createStaleDownloadError(error);
                    }

                    if (size !== entry.size) {
                        throw DefaultFtpService.createStaleDownloadError();
                    }

                    const remainingSize = entry.size - offset;
                    stream.setHeader?.("Content-Length", remainingSize);
                    if (!remainingSize) {
                        stream.end();
                        await finished(stream, { readable: false });
                        return;
                    }

                    source = client.createReadStream(remotePath, { start: offset });
                    session.activeStreams.add(source);
                    session.activeStreams.add(stream);
                    await pipeline(
                        source,
                        DefaultFtpService.createSizeValidator({ expectedSize: remainingSize }),
                        stream
                    );
                }
            });
            session.completedEntries.add(entryPath);
        } catch (err) {
            clearTimeout(session.timeout);
            this.transferSessions.delete(id);
            await this.cleanupTransfer({ session });
            if (err instanceof ApiError && err.code === ftpDownloadStale) {
                throw err;
            }

            throw DefaultFtpService.ftpError({
                message: "Error al descargar",
                apiError: ftpDownloadFailed,
                cause: err
            });
        } finally {
            if (source) {
                session.activeStreams.delete(source);
            }

            session.activeStreams.delete(stream);
            session.activeDownloads -= 1;
            if (
                !session.activeDownloads &&
                session.releaseLocks &&
                session.entries
                    .filter((item) => item.type === fileType)
                    .every((item) => session.completedEntries.has(item.path))
            ) {
                session.releaseLocks();
                session.releaseLocks = undefined;
            }
        }
    }

    async delete({ dir, entries, authUser, onEntry, onComplete = async () => {} }: FtpDeleteParams) {
        try {
            return await this.ftpConnectionManager.execute({
                authUser,
                pool: "transfer",
                paths: entries.map((entry) => path.posix.join(dir, entry.name)),
                sharedPaths: DefaultFtpService.getParentPaths({ dir }),
                treePaths: entries
                    .filter((entry) => entry.type === dirType)
                    .map((entry) => path.posix.join(dir, entry.name)),
                callback: async ({ client }) => {
                    for (const entry of entries) {
                        const { name, type } = entry;
                        const remotePath = `${dir}/${name}`;
                        if (type === dirType) {
                            await client.rmdir(remotePath, true);
                        } else {
                            await client.delete(remotePath);
                        }

                        await onEntry(entry);
                    }

                    await onComplete();
                }
            });
        } catch (err) {
            throw DefaultFtpService.ftpError({ message: "Error al borrar", apiError: ftpDeleteFailed, cause: err });
        }
    }

    private async createThumbnail({ client, remotePath, size }: FtpThumbnailParams): Promise<Buffer | null> {
        if (!size) {
            return null;
        }

        const id = randomUUID();
        const timeout = setTimeout(() => this.mediaSessions.delete(id), ftpMediaSessionTimeout);
        this.mediaSessions.set(id, {
            size,
            createReadStream: ({ start, end }) => client.createReadStream(remotePath, { start, end })
        });
        try {
            const response = await fetch(`${thumbnailGeneratorUrl}/thumbnail/${id}`, {
                method: "POST",
                signal: AbortSignal.timeout(ftpMediaSessionTimeout)
            });
            if (!response.ok) {
                if (response.status >= 500) {
                    DefaultFtpService.LOGGER.warn({
                        event: backgroundFailed,
                        message: "Thumbnail service request failed",
                        context: `Request: ${id}, HTTP status: ${response.status}`
                    });
                }

                return null;
            }

            return DefaultFtpService.readResponseBuffer(response, ftpMaxThumbnailSize);
        } finally {
            clearTimeout(timeout);
            this.mediaSessions.delete(id);
        }
    }

    private static async readResponseBuffer(response: Response, maxSize: number): Promise<Buffer> {
        const contentLength = Number(response.headers.get("content-length"));
        ApiError.handle([
            {
                condition: contentLength > maxSize,
                message: "La miniatura supera el tamaño permitido",
                status: 413,
                apiError: ftpThumbnailTooLarge
            }
        ]);

        const chunks = [];
        let size = 0;
        if (!response.body) {
            throw new TypeError("La respuesta no contiene datos");
        }

        for await (const chunk of response.body) {
            size += chunk.length;
            ApiError.handle([
                {
                    condition: size > maxSize,
                    message: "La miniatura supera el tamaño permitido",
                    status: 413,
                    apiError: ftpThumbnailTooLarge
                }
            ]);

            chunks.push(chunk);
        }

        return Buffer.concat(chunks, size);
    }

    private static async *createDownloadEntries({
        client,
        remoteDir,
        entries,
        relativeDir = "."
    }: FtpDownloadEntriesParams): AsyncGenerator<FtpDownloadEntry> {
        for (const entry of entries) {
            const name = path.posix.join(relativeDir, entry.name);
            const remotePath = path.posix.join(remoteDir, entry.name);
            const type = ["d", dirType].includes(entry.type) ? dirType : fileType;
            if (type === fileType) {
                const { size } = await client.stat(remotePath);
                ApiError.handle([
                    {
                        condition: !Number.isSafeInteger(size) || size < 0,
                        message: "El tamaño del archivo no es válido",
                        status: 400,
                        apiError: ftpDownloadFailed
                    }
                ]);
                yield { name, type, remotePath, size };
                continue;
            }

            yield { name, type, remotePath };
            yield* DefaultFtpService.createDownloadEntries({
                client,
                remoteDir: remotePath,
                entries: await client.list(remotePath),
                relativeDir: name
            });
        }
    }

    private static getRange({ source, size }: FtpRangeParams): FtpRange {
        const range = source?.match(/^bytes=(\d*)-(\d*)$/);
        if (!range) {
            return { start: 0, end: size - 1, partial: false };
        }

        if (!range[1]) {
            const length = Math.min(Number(range[2]), size);
            return { start: size - length, end: size - 1, partial: true };
        }

        const start = Number(range[1]);
        const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        return { start, end, partial: true };
    }

    private static getAvailableName({ name, list }: FtpAvailableNameParams): string {
        if (!list.some(({ name: currentName }) => currentName === name)) {
            return name;
        }

        const extension = path.posix.extname(name);
        const baseName = path.posix.basename(name, extension).replace(/ \(\d+\)$/, "");
        let copy = 1;
        while (list.some(({ name: currentName }) => currentName === `${baseName} (${copy})${extension}`)) {
            copy += 1;
        }

        return `${baseName} (${copy})${extension}`;
    }

    private static createChunkCounter({ entry, offset, maxSize }: FtpChunkCounterParams): FtpChunkCounter {
        let chunkSize = 0;
        const counter = Object.assign(
            new Transform({
                transform(chunk, encoding, callback) {
                    chunkSize += chunk.length;
                    const receivedBytes = offset + chunkSize;
                    if (maxSize > 0 && chunkSize > maxSize) {
                        callback(
                            new ApiError({
                                message: "El fragmento supera el tamaño permitido",
                                status: 413,
                                apiError: ftpUploadChunkTooLarge
                            })
                        );
                        return;
                    }

                    if (entry.size !== undefined && receivedBytes > entry.size) {
                        callback(
                            new ApiError({
                                message: "El archivo supera el tamaño declarado",
                                status: 413,
                                apiError: ftpUploadSizeExceeded
                            })
                        );
                        return;
                    }

                    counter.size = receivedBytes;
                    callback(null, chunk);
                }
            }),
            { size: offset }
        );
        return counter;
    }

    private static createSizeValidator({ expectedSize }: FtpSizeValidatorParams): Transform {
        let size = 0;
        return new Transform({
            transform(chunk, encoding, callback) {
                size += chunk.length;
                callback(size > expectedSize ? DefaultFtpService.createStaleDownloadError() : null, chunk);
            },
            flush(callback) {
                callback(size === expectedSize ? null : DefaultFtpService.createStaleDownloadError());
            }
        });
    }

    private static createStaleDownloadError(cause?: unknown): ApiError {
        if (cause !== undefined && !(cause instanceof ApiError)) {
            DefaultFtpService.LOGGER.error({
                event: LOG_EVENT.sftpOperationFailed,
                message: "Failed to check download file",
                error: cause
            });
        }

        return new ApiError({
            message: "El archivo ha cambiado desde que se creó la sesión",
            status: 409,
            apiError: ftpDownloadStale,
            cause
        });
    }

    private getTransferSession(
        params: FtpTransferLookup & { type: (typeof FTP_TRANSFER_TYPE)["upload"] }
    ): FtpUploadState;
    private getTransferSession(
        params: FtpTransferLookup & { type: (typeof FTP_TRANSFER_TYPE)["download"] }
    ): FtpDownloadState;
    private getTransferSession(params: FtpTransferLookup): FtpTransferState;
    private getTransferSession({ id, type, ownerId }: FtpTransferLookup): FtpTransferState {
        const session = this.transferSessions.get(id);
        ApiError.handle([
            {
                condition: !session || session.ownerId !== ownerId || Boolean(type && session.type !== type),
                message: "Sesión de transferencia no válida",
                status: 404,
                apiError: type === FTP_TRANSFER_TYPE.download ? ftpDownloadFailed : ftpUploadFailed
            }
        ]);
        return session!;
    }

    private async expireTransfer({ id }: Pick<FtpTransferParams, "id">): Promise<void> {
        const session = this.transferSessions.get(id);
        this.transferSessions.delete(id);
        await this.cleanupTransfer({ session });
    }

    private static logBackgroundFailure(error: unknown): void {
        DefaultFtpService.LOGGER.error({
            event: backgroundFailed,
            message: "SFTP transfer expiration failed",
            error
        });
    }

    private async getAvailableRemotePath({
        dir,
        name,
        reservedNames = [],
        protectedPath = false,
        authUser
    }: FtpAvailablePathParams): Promise<string> {
        const result = await this.ftpConnectionManager.execute({
            authUser,
            pool: "interactive",
            readOnly: true,
            sharedPaths: protectedPath ? [] : [dir],
            callback: async ({ client }) => {
                const list = await client.list(dir);
                const resources = [...list, ...reservedNames.map((reservedName) => ({ name: reservedName }))];
                return path.posix.join(dir, DefaultFtpService.getAvailableName({ name, list: resources }));
            }
        });
        return result;
    }

    private static getParentPaths({ dir }: Pick<FtpDirectoryParams, "dir">): string[] {
        const paths = [];
        let current = path.posix.normalize(dir);
        while (true) {
            paths.push(current);
            const parent = path.posix.dirname(current);
            if (parent === current) {
                return paths;
            }

            current = parent;
        }
    }

    private static async renameAvailable({
        client,
        sourcePath,
        destinationPath
    }: FtpRenameAvailableParams): Promise<boolean> {
        try {
            await client.rename(sourcePath, destinationPath);
            return false;
        } catch (error) {
            if (await client.exists(destinationPath)) {
                return true;
            }

            throw error;
        }
    }

    private async cleanupTransfer({ session }: FtpTransferCleanupParams): Promise<void> {
        if (!session) {
            return;
        }

        for (const stream of session.activeStreams) {
            stream.destroy();
        }

        if (session.type !== FTP_TRANSFER_TYPE.upload) {
            session.releaseLocks?.();
            return;
        }

        try {
            await this.ftpConnectionManager.execute({
                authUser: { id: session.ownerId },
                pool: "transfer",
                callback: async ({ client }) => {
                    for (const entry of session.entries.values()) {
                        if (entry.type !== fileType || !entry.remotePath) {
                            continue;
                        }

                        try {
                            await client.delete(entry.remotePath);
                        } catch (error) {
                            DefaultFtpService.LOGGER.warn({
                                event: backgroundFailed,
                                message: "SFTP upload cleanup failed",
                                context: `User: ${session.ownerId}`,
                                error
                            });
                            continue;
                        }
                    }

                    const directories = [...session.createdDirs].sort(
                        (a, b) => b.split("/").length - a.split("/").length
                    );
                    for (const remoteDir of directories) {
                        try {
                            await client.rmdir(remoteDir, false);
                        } catch (error) {
                            DefaultFtpService.LOGGER.warn({
                                event: backgroundFailed,
                                message: "SFTP directory cleanup failed",
                                context: `User: ${session.ownerId}`,
                                error
                            });
                            continue;
                        }
                    }
                }
            });
        } catch (error) {
            DefaultFtpService.LOGGER.warn({
                event: backgroundFailed,
                message: "SFTP transfer cleanup failed",
                context: `User: ${session.ownerId}`,
                error: error instanceof ApiError ? undefined : error
            });
            return;
        } finally {
            session.fileLocks.forEach((release) => release());
            session.releaseEntryLocks?.();
            session.releaseLocks?.();
        }
    }

    private static async trackMissingDirectories({
        client,
        remoteDir,
        directories
    }: FtpMissingDirectoriesParams): Promise<void> {
        let currentDir = remoteDir;
        while (![".", "/"].includes(currentDir) && !(await client.exists(currentDir))) {
            directories.add(currentDir);
            currentDir = path.posix.dirname(currentDir);
        }
    }

    private static ftpError({
        message,
        apiError,
        cause
    }: Pick<ApiErrorOptions, "message" | "apiError" | "cause">): ApiError {
        if (!(cause instanceof ApiError)) {
            DefaultFtpService.LOGGER.error({
                event: LOG_EVENT.sftpOperationFailed,
                message: "SFTP operation failed",
                context: `Error code: ${apiError}`,
                error: cause
            });
        }

        return new ApiError({ message, apiError, cause });
    }
}
