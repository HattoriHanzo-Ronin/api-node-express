import type {
    ExecuteFtpOperationParams,
    FtpLockTransferParams,
    Release
} from "../../../../types/ftp-connection-manager.js";
import type { AuthenticatedUser } from "../../../../types/users-facade.js";

/**
 * FTP connection manager contract
 *
 * @author HattoriHanzo-Ronin
 */
export default interface FtpConnectionManager<Client> {
    /**
     * Executes an FTP operation
     *
     * @param authUser Authenticated user
     * @param pool Operation connection type
     * @param paths Exclusively locked paths
     * @param sharedPaths Shared locked paths
     * @param treePaths Exclusively locked paths and their descendants
     * @param skipLocked Whether to omit the operation when a path is locked
     * @param transfer Whether the operation reserves a transfer position
     * @param callback Operation
     * @returns Operation result, or undefined when the operation is omitted
     */
    execute<Result>(params: ExecuteFtpOperationParams<Client, Result>): Promise<Result | undefined>;

    /**
     * Returns whether a user session is active
     *
     * @param ownerId User identifier
     * @returns Whether the session is active
     */
    isActive(params: { ownerId: string }): boolean;

    /**
     * Registers authenticated user activity
     *
     * @param authUser Authenticated user
     */
    touch(params: { authUser: AuthenticatedUser }): Promise<void>;

    /**
     * Locks paths for the lifetime of a transfer session
     *
     * @param authUser Authenticated user
     * @param paths Exclusively locked paths
     * @param sharedPaths Shared locked paths
     * @param treePaths Exclusively locked paths and their descendants
     * @returns Lock release function
     */
    lockTransfer(params: FtpLockTransferParams): Promise<Release>;

    /**
     * Closes every managed FTP connection
     */
    closeAll(): Promise<void>;
}
