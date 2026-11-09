import type {
    FtpDirectoryResponse,
    FtpFacadeCreateUploadParams,
    FtpFacadeDeleteParams,
    FtpFacadeDirectoryParams,
    FtpFacadeDownloadParams,
    FtpFacadeEntriesParams,
    FtpFacadeMakeDirParams,
    FtpFacadeMoveParams,
    FtpFacadeRenameParams,
    FtpFacadeTransferParams,
    FtpFacadeUploadParams,
    FtpThumbnailParams
} from "../types/ftp/ftp-facade.js";
import type { FtpDownloadSession, FtpMediaParams, FtpUploadSession } from "../types/ftp/ftp-service.js";

export default interface FtpFacade<MediaStream, ProgressStream, DownloadStream, UploadFile, Thumbnail> {
    /**
     * Returns FTP directory content
     *
     * @param params.dir Directory path
     * @param params.authUser Authenticated user
     * @returns Directory entries and hash
     */
    dir(params: FtpFacadeDirectoryParams): Promise<FtpDirectoryResponse>;
    /**
     * Streams a temporary media resource
     *
     * @param params.id Media session identifier
     * @param params.range Requested byte range
     * @param params.method HTTP method
     * @param params.stream Destination stream
     */
    streamMedia(params: FtpMediaParams<MediaStream>): Promise<void>;
    /**
     * Returns a cached thumbnail
     *
     * @param params.dir Directory path
     * @param params.name File name
     * @param params.authUser Authenticated user
     * @returns Thumbnail or null
     */
    getThumbnail(params: FtpThumbnailParams): Promise<Thumbnail | null>;
    /**
     * Creates a directory
     *
     * @param params.dir Parent directory
     * @param params.name Directory name
     * @param params.authUser Authenticated user
     * @returns Updated directory
     */
    makeDir(params: FtpFacadeMakeDirParams): Promise<FtpDirectoryResponse>;
    /**
     * Moves FTP entries
     *
     * @param params.dir Source directory
     * @param params.entries Entries to move
     * @param params.destination Destination directory
     * @param params.authUser Authenticated user
     * @param params.stream Progress stream
     */
    move(params: FtpFacadeMoveParams<ProgressStream>): Promise<void>;
    /**
     * Renames an FTP entry
     *
     * @param params.dir Directory path
     * @param params.entry Entry to rename
     * @param params.newName New entry name
     * @param params.authUser Authenticated user
     * @returns Updated directory
     */
    rename(params: FtpFacadeRenameParams): Promise<FtpDirectoryResponse>;
    /**
     * Creates an upload session
     *
     * @param params.dir Directory path
     * @param params.entries Upload entries
     * @param params.authUser Authenticated user
     * @returns Upload session
     */
    createUpload(params: FtpFacadeCreateUploadParams): Promise<FtpUploadSession>;
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
    uploadEntry(params: FtpFacadeUploadParams<UploadFile>): Promise<{ nextOffset: number }>;
    /**
     * Completes an upload session
     *
     * @param params.id Session identifier
     * @param params.authUser Authenticated user
     * @returns Updated directory
     */
    completeUpload(params: FtpFacadeTransferParams): Promise<FtpDirectoryResponse>;
    /**
     * Cancels a transfer session
     *
     * @param params.id Session identifier
     * @param params.authUser Authenticated user
     */
    cancelTransfer(params: FtpFacadeTransferParams): Promise<void>;
    /**
     * Creates a download session
     *
     * @param params.dir Directory path
     * @param params.entries Download entries
     * @param params.authUser Authenticated user
     * @returns Download session
     */
    createDownload(params: FtpFacadeEntriesParams): Promise<FtpDownloadSession>;
    /**
     * Downloads a session entry
     *
     * @param params.id Session identifier
     * @param params.entryPath Entry path
     * @param params.offset Byte offset
     * @param params.authUser Authenticated user
     * @param params.stream Destination stream
     */
    downloadEntry(params: FtpFacadeDownloadParams<DownloadStream>): Promise<void>;
    /**
     * Deletes FTP entries
     *
     * @param params.dir Directory path
     * @param params.entries Entries to delete
     * @param params.authUser Authenticated user
     * @param params.stream Progress stream
     */
    delete(params: FtpFacadeDeleteParams<ProgressStream>): Promise<void>;
}
