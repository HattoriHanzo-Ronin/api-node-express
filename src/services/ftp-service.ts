import type {
    FtpCompleteUploadParams,
    FtpCreateUploadParams,
    FtpDeleteParams,
    FtpDirectoryListParams,
    FtpDownloadParams,
    FtpDownloadSession,
    FtpEntriesParams,
    FtpEntry,
    FtpMakeDirParams,
    FtpMediaParams,
    FtpMoveParams,
    FtpOwnerParams,
    FtpRenameParams,
    FtpThumbnailsParams,
    FtpTransferParams,
    FtpUploadParams,
    FtpUploadSession
} from "../types/ftp/ftp-service.js";

export default interface FtpService<MediaStream, DownloadStream, UploadFile, Thumbnail, SourceEntry> {
    /**
     * Returns whether a user session is active
     *
     * @param params.ownerId User identifier
     * @returns Whether the session is active
     */
    isSessionActive(params: FtpOwnerParams): boolean;

    /**
     * Returns a directory's entries
     *
     * @param params.dir Directory path
     * @param params.authUser Authenticated user
     * @param params.watcher Whether the request is a background watch
     * @returns Directory entries or undefined if skipped
     */
    dir(params: FtpDirectoryListParams & { watcher?: false }): Promise<SourceEntry[]>;
    dir(params: FtpDirectoryListParams): Promise<SourceEntry[] | undefined>;

    /**
     * Generates thumbnails for directory entries
     *
     * @param params.dir Directory path
     * @param params.names File names
     * @param params.authUser Authenticated user
     * @param params.callback Thumbnail callback
     */
    getThumbnails(params: FtpThumbnailsParams<Thumbnail>): Promise<void>;

    /**
     * Streams a temporary media session
     *
     * @param params.id Media session identifier
     * @param params.range Requested range
     * @param params.method HTTP method
     * @param params.stream Destination stream
     */
    streamMedia(params: FtpMediaParams<MediaStream>): Promise<void>;

    /**
     * Creates a directory
     *
     * @param params.dir Parent directory
     * @param params.name Directory name
     * @param params.authUser Authenticated user
     */
    makeDir(params: FtpMakeDirParams): Promise<void>;

    /**
     * Moves entries between directories
     *
     * @param params.dir Source directory
     * @param params.entries Entries to move
     * @param params.destination Destination directory
     * @param params.authUser Authenticated user
     * @param params.onEntry Entry callback
     * @param params.onComplete Completion callback
     */
    move(params: FtpMoveParams): Promise<void>;

    /**
     * Renames an entry
     *
     * @param params.dir Directory path
     * @param params.entry Entry to rename
     * @param params.newName New entry name
     * @param params.authUser Authenticated user
     * @returns Renamed entry
     */
    rename(params: FtpRenameParams): Promise<FtpEntry>;

    /**
     * Creates an upload session
     *
     * @param params.dir Directory path
     * @param params.entries Upload entries
     * @param params.authUser Authenticated user
     * @returns Upload session
     */
    createUpload(params: FtpCreateUploadParams): Promise<FtpUploadSession>;

    /**
     * Uploads a session entry
     *
     * @param params.id Session identifier
     * @param params.entryPath Entry path
     * @param params.offset Chunk offset
     * @param params.file Uploaded file
     * @param params.authUser Authenticated user
     * @returns Next offset
     */
    upload(params: FtpUploadParams<UploadFile>): Promise<{ nextOffset: number }>;

    /**
     * Completes an upload session
     *
     * @param params.id Session identifier
     * @param params.authUser Authenticated user
     * @param params.onComplete Completion callback
     * @returns Completion result
     */
    completeUpload(params: FtpTransferParams): Promise<{ dir: string }>;
    completeUpload<Result>(params: FtpCompleteUploadParams<Result>): Promise<Result>;

    /**
     * Cancels a transfer session
     *
     * @param params.id Session identifier
     * @param params.authUser Authenticated user
     */
    cancelTransfer(params: FtpTransferParams): Promise<void>;

    /**
     * Creates a download session
     *
     * @param params.dir Directory path
     * @param params.entries Download entries
     * @param params.authUser Authenticated user
     * @returns Download session
     */
    createDownload(params: FtpEntriesParams): Promise<FtpDownloadSession>;

    /**
     * Downloads a session entry
     *
     * @param params.id Session identifier
     * @param params.entryPath Entry path
     * @param params.offset Byte offset
     * @param params.authUser Authenticated user
     * @param params.stream Destination stream
     */
    download(params: FtpDownloadParams<DownloadStream>): Promise<void>;

    /**
     * Deletes entries from a directory
     *
     * @param params.dir Directory path
     * @param params.entries Entries to delete
     * @param params.authUser Authenticated user
     * @param params.onEntry Entry callback
     * @param params.onComplete Completion callback
     */
    delete(params: FtpDeleteParams): Promise<void>;
}
