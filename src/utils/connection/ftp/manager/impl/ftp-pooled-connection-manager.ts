import FtpClient from "../../ftp-client.js";
import type SftpClient from "ssh2-sftp-client";
import { ENV } from "../../../../../config/environment.js";
import { LOG_EVENT } from "../../../../../config/log-events.js";
import Logger from "../../../../logger/logger.js";
import { API_ERROR } from "../../../../../config/errors.js";
import ApiError from "../../../../error/api-error.js";
import type FtpConnectionManager from "../ftp-connection-manager.js";
import type {
    ExecuteFtpOperationParams,
    FtpLockRequest,
    FtpLockTransferParams,
    FtpPoolType,
    Release
} from "../../../../../types/ftp/ftp-connection-manager.js";
import type {
    FtpCapacityPending,
    FtpConnection,
    FtpConnectionManagerDependencies,
    FtpConnectionPending,
    FtpEvictionCandidate,
    FtpPool,
    FtpPoolConfiguration,
    FtpSession,
    FtpTransferPending
} from "../../../../../types/ftp/ftp-pooled-connection-manager.js";
import type {
    FtpSessionUser,
    ExecuteRequiredFtpOperationParams
} from "../../../../../types/ftp/ftp-connection-manager.js";

const { sftpConnectionFailed, sftpConnectionOpened, sftpConnectionClosed, backgroundFailed } = LOG_EVENT;

const {
    ftpMaxConnections,
    ftpMaxTransfers,
    ftpIdleTimeout,
    ftpScaleWait,
    ftpWatcherPoolMin,
    ftpWatcherPoolMax,
    ftpInteractivePoolMin,
    ftpInteractivePoolMax,
    ftpTransferPoolMin,
    ftpTransferPoolMax,
    protectedUsers
} = ENV;
const {
    ftpConfigurationInvalid,
    ftpManagerClosed,
    ftpPoolScaleFailed,
    ftpConnectionCloseFailed,
    ftpPoolRestoreFailed,
    ftpSessionClosed
} = API_ERROR;
const { getClient, closeClient: ftpCloseClient } = FtpClient;

const FTP_POOL_TYPES: FtpPoolType[] = ["watcher", "interactive", "transfer"];
const SCALABLE_FTP_POOL_TYPES: FtpPoolType[] = ["transfer"];

/**
 * Manages isolated SFTP connection pools per authenticated user
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpPooledConnectionManager implements FtpConnectionManager<SftpClient> {
    private static readonly LOGGER = Logger.getLogger(FtpPooledConnectionManager);
    private static readonly POOL_CONFIG: FtpPoolConfiguration = Object.freeze({
        watcher: { min: ftpWatcherPoolMin, max: ftpWatcherPoolMax },
        interactive: { min: ftpInteractivePoolMin, max: ftpInteractivePoolMax },
        transfer: { min: ftpTransferPoolMin, max: ftpTransferPoolMax }
    });
    private static readonly MIN_CONNECTIONS_PER_USER = Object.values(FtpPooledConnectionManager.POOL_CONFIG).reduce(
        (total, { min }) => total + min,
        0
    );
    private static readonly MAX_CONNECTIONS_PER_USER = Object.values(FtpPooledConnectionManager.POOL_CONFIG).reduce(
        (total, { max }) => total + max,
        0
    );
    private static readonly PROTECTED_USER_IDS = FtpPooledConnectionManager.createProtectedUserIds();

    static {
        FtpPooledConnectionManager.validateConfiguration();
        const reservedConnections = [...FtpPooledConnectionManager.PROTECTED_USER_IDS.values()].reduce(
            (total, reserved) => total + reserved,
            0
        );
        if (
            reservedConnections > ftpMaxConnections ||
            [...FtpPooledConnectionManager.PROTECTED_USER_IDS.values()].some(
                (reserved) =>
                    reserved < FtpPooledConnectionManager.MIN_CONNECTIONS_PER_USER ||
                    reserved > FtpPooledConnectionManager.MAX_CONNECTIONS_PER_USER
            )
        ) {
            throw new ApiError({
                message: "Las reservas SFTP superan el límite global de conexiones",
                apiError: ftpConfigurationInvalid
            });
        }
    }

    private createClient: NonNullable<FtpConnectionManagerDependencies["createClient"]>;
    private closeClient: NonNullable<FtpConnectionManagerDependencies["closeClient"]>;
    private sessions = new Map<string, FtpSession>();
    private totalConnections = 0;
    private activeTransfers = 0;
    private transferQueue: FtpTransferPending[] = [];
    private capacityQueue: FtpCapacityPending[] = [];
    private allocationTail: Promise<void> = Promise.resolve();

    constructor({ createClient = getClient, closeClient = ftpCloseClient }: FtpConnectionManagerDependencies = {}) {
        this.createClient = createClient;
        this.closeClient = closeClient;
    }

    async execute<Result>(params: ExecuteRequiredFtpOperationParams<SftpClient, Result>): Promise<Result>;
    async execute<Result>(params: ExecuteFtpOperationParams<SftpClient, Result>): Promise<Result | undefined>;
    async execute<Result>({
        authUser,
        pool,
        paths = [],
        sharedPaths = [],
        treePaths = [],
        skipLocked = false,
        readOnly = false,
        transfer = false,
        callback
    }: ExecuteFtpOperationParams<SftpClient, Result>): Promise<Result | undefined> {
        let session = this.sessions.get(authUser.id);
        if (pool === "watcher") {
            if (!session || !this.isSessionActive(session)) {
                return undefined;
            }
        } else {
            session ??= await this.getSession(authUser);
        }

        if (pool !== "watcher") {
            this.touchSession(session);
        }

        let releaseTransfer: Release = () => {};
        let releasePaths: Release = () => {};
        let connection: FtpConnection | undefined;
        try {
            if (transfer) {
                releaseTransfer = await this.acquireTransfer(authUser.id);
            }

            if (pool !== "watcher") {
                releasePaths = await this.lockPaths(
                    session,
                    readOnly ? [] : paths,
                    readOnly ? [...paths, ...sharedPaths] : sharedPaths,
                    treePaths
                );
            }

            connection = await this.acquire(session, pool);
            if (skipLocked) {
                const releaseWatcherPaths = this.tryLockPaths(session, [], paths);
                if (!releaseWatcherPaths) {
                    return undefined;
                }

                releasePaths = releaseWatcherPaths;
            }

            return await callback({ client: await connection.clientPromise });
        } catch (error) {
            if (connection && this.isConnectionError(error)) {
                await this.removeConnection(session, pool, connection);
                connection = undefined;
                await this.restorePool(session, pool);
            }

            throw error;
        } finally {
            if (connection) {
                this.release(session, pool, connection);
            }

            releasePaths();
            releaseTransfer();
            if (!connection && session.expired) {
                void this.closeSession(session).catch(FtpPooledConnectionManager.logBackgroundFailure);
            }
        }
    }

    isActive({ ownerId }: { ownerId: string }) {
        const session = this.sessions.get(ownerId);
        return Boolean(session && this.isSessionActive(session));
    }

    async touch({ authUser }: { authUser: FtpSessionUser }) {
        const session = await this.getSession(authUser);
        this.touchSession(session);
    }

    async lockTransfer({ authUser, paths, sharedPaths, treePaths, sharedTreePaths }: FtpLockTransferParams) {
        const session = await this.getSession(authUser);
        this.touchSession(session);
        session.transferLocks += 1;
        try {
            const release = await this.lockPaths(session, paths, sharedPaths, treePaths, sharedTreePaths);
            let released = false;
            return () => {
                if (released) {
                    return;
                }

                released = true;
                release();
                session.transferLocks -= 1;
                if (session.expired) {
                    void this.closeSession(session).catch(FtpPooledConnectionManager.logBackgroundFailure);
                }
            };
        } catch (error) {
            session.transferLocks -= 1;
            throw error;
        }
    }

    async closeAll() {
        for (const pending of this.transferQueue.splice(0)) {
            pending.reject(new ApiError({ message: "El gestor SFTP se ha cerrado", apiError: ftpManagerClosed }));
        }
        for (const pending of this.capacityQueue.splice(0)) {
            pending.reject(new ApiError({ message: "El gestor SFTP se ha cerrado", apiError: ftpManagerClosed }));
        }
        await Promise.all([...this.sessions.values()].map((session) => this.closeSession(session, true)));
    }

    private acquireTransfer(ownerId: string): Promise<Release> {
        if (this.activeTransfers < ftpMaxTransfers) {
            this.activeTransfers += 1;
            return Promise.resolve(() => this.releaseTransfer());
        }
        if (this.transferQueue.length === 0) {
            FtpPooledConnectionManager.LOGGER.info({
                event: LOG_EVENT.sftpTransferLimitReached,
                message: "SFTP transfer capacity has waiting operations",
                context: `User: ${ownerId}, global limit: ${ftpMaxTransfers}`
            });
        }

        return new Promise<Release>((resolve, reject) => this.transferQueue.push({ resolve, reject }));
    }

    private releaseTransfer(): void {
        const pending = this.transferQueue.shift();
        if (pending) {
            pending.resolve(() => this.releaseTransfer());
            return;
        }
        this.activeTransfers -= 1;
    }

    private async getSession(authUser: FtpSessionUser): Promise<FtpSession> {
        let session = this.sessions.get(authUser.id);
        if (session) {
            return session;
        }

        session = {
            ownerId: authUser.id,
            lastActivity: Date.now(),
            pools: {
                watcher: { connections: [], queue: [] },
                interactive: { connections: [], queue: [] },
                transfer: { connections: [], queue: [] }
            },
            lockedPaths: new Map<string, { exclusive: boolean; shared: number }>(),
            lockedTrees: new Set<string>(),
            sharedTrees: new Map<string, number>(),
            transferLocks: 0,
            lockQueue: [],
            closing: false,
            initializing: Promise.resolve()
        };
        this.sessions.set(authUser.id, session);
        session.initializing = Promise.allSettled(
            FTP_POOL_TYPES.flatMap((pool) =>
                Array.from({ length: FtpPooledConnectionManager.POOL_CONFIG[pool].min }, () =>
                    this.addConnection(session, pool)
                )
            )
        )
            .then((results) => {
                const rejected = results.find((result) => result.status === "rejected");
                if (rejected) {
                    throw rejected.reason;
                }

                for (const result of results) {
                    if (result.status === "fulfilled" && result.value) {
                        result.value.busy = false;
                    }
                }
            })
            .catch(async (error) => {
                await this.closeSession(session, true);
                throw error;
            });
        await session.initializing;
        this.touchSession(session);
        return session;
    }

    private async acquire(session: FtpSession, type: FtpPoolType): Promise<FtpConnection> {
        await session.initializing;
        const pool = session.pools[type];
        const connection = pool.connections.find((item) => !item.busy);
        if (connection) {
            connection.busy = true;
            return connection;
        }

        if (pool.connections.length < FtpPooledConnectionManager.POOL_CONFIG[type].min) {
            const newConnection = await this.addConnection(session, type);
            if (newConnection) {
                newConnection.busy = true;
                return newConnection;
            }

            return this.acquire(session, type);
        }

        return new Promise<FtpConnection>((resolve, reject) => {
            const pending: FtpConnectionPending = { resolve, reject };
            const wasEmpty = pool.queue.length === 0;
            pool.queue.push(pending);
            if (wasEmpty && pool.connections.length >= FtpPooledConnectionManager.POOL_CONFIG[type].max) {
                FtpPooledConnectionManager.logSaturatedPool(session, type);
            }

            if (type === "transfer" && pool.connections.length < FtpPooledConnectionManager.POOL_CONFIG.transfer.max) {
                pending.scaleTimeout = setTimeout(() => void this.scale(session, type), ftpScaleWait);
                pending.scaleTimeout.unref();
            }
        });
    }

    private async scale(session: FtpSession, type: FtpPoolType): Promise<void> {
        const pool = session.pools[type];
        if (!pool.queue.length || pool.connections.length >= FtpPooledConnectionManager.POOL_CONFIG[type].max) {
            return;
        }
        try {
            const connection = await this.addConnection(
                session,
                type,
                () =>
                    pool.queue.length > 0 && pool.connections.length < FtpPooledConnectionManager.POOL_CONFIG[type].max
            );
            if (connection && !this.dispatch(pool, connection)) {
                connection.busy = false;
            }
            if (
                connection &&
                pool.queue.length &&
                pool.connections.length >= FtpPooledConnectionManager.POOL_CONFIG[type].max
            ) {
                FtpPooledConnectionManager.logSaturatedPool(session, type);
            }
        } catch (error) {
            if (!(error instanceof ApiError)) {
                FtpPooledConnectionManager.LOGGER.error({
                    event: sftpConnectionFailed,
                    message: "SFTP pool expansion failed",
                    context: `User: ${session.ownerId}, pool: ${type}`,
                    error
                });
            }
            const waiting = pool.queue.shift();
            if (!waiting) {
                return;
            }

            clearTimeout(waiting.scaleTimeout);
            waiting.reject(
                new ApiError({
                    message: "No se ha podido ampliar el pool SFTP",
                    apiError: ftpPoolScaleFailed,
                    cause: error
                })
            );
        }
    }

    private release(session: FtpSession, type: FtpPoolType, connection: FtpConnection): void {
        connection.busy = false;
        connection.lastUsed = Date.now();
        const pool = session.pools[type];
        this.capacityQueue.shift()?.resolve();
        if (!this.dispatch(pool, connection) && session.expired) {
            void this.closeSession(session).catch(FtpPooledConnectionManager.logBackgroundFailure);
        }
    }

    private dispatch(pool: FtpPool, connection: FtpConnection): boolean {
        const pending = pool.queue.shift();
        if (!pending) {
            return false;
        }
        clearTimeout(pending.scaleTimeout);
        connection.busy = true;
        pending.resolve(connection);
        return true;
    }

    private async addConnection(
        session: FtpSession,
        type: FtpPoolType,
        isNeeded: () => boolean = () => true
    ): Promise<FtpConnection | null> {
        let releaseAllocation: Release = () => {};
        const previousAllocation = this.allocationTail;
        this.allocationTail = new Promise((resolve) => {
            releaseAllocation = resolve;
        });
        await previousAllocation;
        let connection: FtpConnection | undefined;
        try {
            if (!(await this.ensureCapacity(session, isNeeded)) || !isNeeded()) {
                return null;
            }
            connection = {
                type,
                busy: true,
                lastUsed: Date.now(),
                clientPromise: Promise.resolve().then(() => this.createClient({ ownerId: session.ownerId }))
            };
            session.pools[type].connections.push(connection);
            this.totalConnections += 1;
        } finally {
            releaseAllocation();
        }
        if (!connection) {
            return null;
        }
        try {
            await connection.clientPromise;
            FtpPooledConnectionManager.LOGGER.info({
                event: sftpConnectionOpened,
                message: "SFTP connection opened",
                context: `User: ${session.ownerId}, pool: ${type}`
            });
            return connection;
        } catch (error) {
            FtpPooledConnectionManager.LOGGER.info({
                event: sftpConnectionFailed,
                message: "SFTP connection failed",
                context: `User: ${session.ownerId}, pool: ${type}`
            });
            await this.removeConnection(session, type, connection);
            throw error;
        }
    }

    private async ensureCapacity(requestSession: FtpSession, isNeeded: () => boolean): Promise<boolean> {
        while (!this.hasCapacity(requestSession)) {
            if (!isNeeded()) {
                return false;
            }
            const candidate = this.getEvictionCandidate(requestSession.ownerId);
            if (!candidate) {
                if (this.capacityQueue.length === 0) {
                    FtpPooledConnectionManager.LOGGER.info({
                        event: LOG_EVENT.sftpCapacitySaturated,
                        message: "SFTP connection capacity has waiting operations",
                        context: `User: ${requestSession.ownerId}, global limit: ${ftpMaxConnections}`
                    });
                }

                await new Promise<void>((resolve, reject) => this.capacityQueue.push({ resolve, reject }));
                continue;
            }
            if ("connection" in candidate) {
                await this.removeConnection(candidate.session, candidate.type, candidate.connection);
            } else {
                await this.closeSession(candidate.session, true);
            }
        }
        return isNeeded();
    }

    private hasCapacity(requestSession: FtpSession): boolean {
        const projectedCounts = new Map<string, number>();
        for (const session of this.sessions.values()) {
            projectedCounts.set(session.ownerId, this.countConnections(session));
        }
        projectedCounts.set(requestSession.ownerId, (projectedCounts.get(requestSession.ownerId) ?? 0) + 1);
        const unclaimedReservations = [...FtpPooledConnectionManager.PROTECTED_USER_IDS].reduce(
            (total, [ownerId, reserved]) => total + Math.max(0, reserved - (projectedCounts.get(ownerId) ?? 0)),
            0
        );
        return this.totalConnections + 1 + unclaimedReservations <= ftpMaxConnections;
    }

    private getEvictionCandidate(excludedOwnerId: string): FtpEvictionCandidate | undefined {
        const sessions = [...this.sessions.values()];
        for (const session of sessions.sort((a, b) => a.lastActivity - b.lastActivity)) {
            for (const type of SCALABLE_FTP_POOL_TYPES) {
                const pool = session.pools[type];
                const minimum = FtpPooledConnectionManager.POOL_CONFIG[type].min;
                const connection = pool.connections.find((item, index) => index >= minimum && !item.busy);
                if (connection) {
                    return { session, type, connection };
                }
            }
        }
        return sessions
            .filter((session) => session.ownerId !== excludedOwnerId)
            .filter(
                (session) =>
                    !FtpPooledConnectionManager.PROTECTED_USER_IDS.has(session.ownerId) && this.isSessionIdle(session)
            )
            .map((session) => ({ session }))
            .at(0);
    }

    private async removeConnection(session: FtpSession, type: FtpPoolType, connection: FtpConnection): Promise<void> {
        const pool = session.pools[type];
        const index = pool.connections.indexOf(connection);
        if (index === -1) {
            return;
        }
        pool.connections.splice(index, 1);
        this.totalConnections -= 1;
        this.capacityQueue.shift()?.resolve();
        const result = await Promise.allSettled([connection.clientPromise]);
        if (result[0].status === "rejected") {
            return;
        }
        try {
            await this.closeClient({ client: result[0].value });
            FtpPooledConnectionManager.LOGGER.info({
                event: sftpConnectionClosed,
                message: "SFTP connection closed",
                context: `User: ${session.ownerId}, pool: ${type}`
            });
        } catch (error) {
            if (!(error instanceof ApiError)) {
                FtpPooledConnectionManager.LOGGER.error({
                    event: sftpConnectionFailed,
                    message: "SFTP connection close failed",
                    context: `User: ${session.ownerId}, pool: ${type}`,
                    error
                });
            }
            throw new ApiError({
                message: "No se ha podido cerrar la conexión SFTP",
                apiError: ftpConnectionCloseFailed,
                cause: error
            });
        }
    }

    private async restorePool(session: FtpSession, type: FtpPoolType): Promise<void> {
        if (session.closing || session.expired) {
            return;
        }
        const pool = session.pools[type];
        if (pool.connections.length >= FtpPooledConnectionManager.POOL_CONFIG[type].min && !pool.queue.length) {
            return;
        }
        try {
            const connection = await this.addConnection(session, type);
            if (connection && !this.dispatch(pool, connection)) {
                connection.busy = false;
            }
        } catch (error) {
            if (!(error instanceof ApiError)) {
                FtpPooledConnectionManager.LOGGER.error({
                    event: sftpConnectionFailed,
                    message: "SFTP pool restoration failed",
                    context: `User: ${session.ownerId}, pool: ${type}`,
                    error
                });
            }
            throw new ApiError({
                message: "No se ha podido restaurar el pool SFTP",
                apiError: ftpPoolRestoreFailed,
                cause: error
            });
        }
    }

    private touchSession(session: FtpSession): void {
        session.lastActivity = Date.now();
        session.expired = false;
        clearTimeout(session.idleTimeout);
        session.idleTimeout = setTimeout(
            () => void this.expire(session).catch(FtpPooledConnectionManager.logBackgroundFailure),
            ftpIdleTimeout
        );
        session.idleTimeout.unref();
    }

    private async expire(session: FtpSession): Promise<void> {
        session.expired = true;
        if (!this.isSessionIdle(session)) {
            return;
        }
        if (FtpPooledConnectionManager.PROTECTED_USER_IDS.has(session.ownerId)) {
            await this.trimProtectedSession(session);
            return;
        }
        await this.closeSession(session, true);
    }

    private async trimProtectedSession(session: FtpSession): Promise<void> {
        for (const type of SCALABLE_FTP_POOL_TYPES) {
            const pool = session.pools[type];
            while (pool.connections.length > FtpPooledConnectionManager.POOL_CONFIG[type].min) {
                const connection = pool.connections.at(-1);
                if (!connection) {
                    return;
                }

                await this.removeConnection(session, type, connection);
            }
        }
    }

    private async closeSession(session: FtpSession, force = false): Promise<void> {
        if (session.closing || (!force && !this.isSessionIdle(session))) {
            return;
        }
        session.closing = true;
        clearTimeout(session.idleTimeout);
        this.sessions.delete(session.ownerId);
        for (const type of FTP_POOL_TYPES) {
            const pool = session.pools[type];
            for (const pending of pool.queue.splice(0)) {
                clearTimeout(pending.scaleTimeout);
                pending.reject(new ApiError({ message: "La sesión SFTP se ha cerrado", apiError: ftpSessionClosed }));
            }
        }
        for (const pending of session.lockQueue.splice(0)) {
            pending.reject(new ApiError({ message: "La sesión SFTP se ha cerrado", apiError: ftpSessionClosed }));
        }
        await Promise.all(
            FTP_POOL_TYPES.flatMap((type) =>
                [...session.pools[type].connections].map((connection) =>
                    this.removeConnection(session, type, connection)
                )
            )
        );
    }

    private async lockPaths(
        session: FtpSession,
        paths: string[],
        sharedPaths: string[],
        treePaths: string[],
        sharedTreePaths: string[] = []
    ): Promise<Release> {
        const request = this.normalizeLockRequest(paths, sharedPaths, treePaths, sharedTreePaths);
        const queuedRequest = {
            ...request,
            sharedPaths: request.sharedPaths.filter((path) => !session.lockedPaths.get(path)?.shared)
        };
        const release =
            !session.lockQueue.some(
                (pending) => !pending.treePaths.length && this.lockRequestsConflict(queuedRequest, pending)
            ) &&
            this.tryLockPaths(session, request.paths, request.sharedPaths, request.treePaths, request.sharedTreePaths);
        if (release) {
            return release;
        }

        return new Promise<Release>((resolve, reject) => session.lockQueue.push({ ...request, resolve, reject }));
    }

    private tryLockPaths(
        session: FtpSession,
        paths: string[],
        sharedPaths: string[] = [],
        treePaths: string[] = [],
        sharedTreePaths: string[] = []
    ): Release | null {
        if (
            paths.some((path) => session.lockedPaths.has(path)) ||
            sharedPaths.some((path) => session.lockedPaths.get(path)?.exclusive) ||
            [...paths, ...treePaths].some((path) =>
                [...session.sharedTrees.keys()].some(
                    (tree) => this.isWithinPath(path, tree) || this.isWithinPath(tree, path)
                )
            ) ||
            sharedTreePaths.some(
                (tree) =>
                    [...session.lockedTrees].some(
                        (lockedTree) => this.isWithinPath(tree, lockedTree) || this.isWithinPath(lockedTree, tree)
                    ) ||
                    [...session.lockedPaths].some(
                        ([path, lock]) =>
                            lock.exclusive && (this.isWithinPath(path, tree) || this.isWithinPath(tree, path))
                    )
            ) ||
            [...paths, ...sharedPaths, ...treePaths].some((path) =>
                [...session.lockedTrees].some((tree) => this.isWithinPath(path, tree))
            ) ||
            paths.some((path) => [...session.lockedTrees].some((tree) => this.isWithinPath(tree, path))) ||
            treePaths.some((tree) =>
                [...session.lockedPaths.keys(), ...session.lockedTrees].some(
                    (path) =>
                        this.isWithinPath(path, tree) ||
                        (session.lockedPaths.get(path)?.exclusive && this.isWithinPath(tree, path))
                )
            )
        ) {
            return null;
        }

        paths.forEach((path) => session.lockedPaths.set(path, { exclusive: true, shared: 0 }));
        sharedPaths.forEach((path) => {
            const lock = session.lockedPaths.get(path) ?? { exclusive: false, shared: 0 };
            lock.shared += 1;
            session.lockedPaths.set(path, lock);
        });
        treePaths.forEach((path) => session.lockedTrees.add(path));
        sharedTreePaths.forEach((path) => session.sharedTrees.set(path, (session.sharedTrees.get(path) ?? 0) + 1));
        return () => {
            paths.forEach((path) => session.lockedPaths.delete(path));
            sharedPaths.forEach((path) => {
                const lock = session.lockedPaths.get(path);
                if (!lock) {
                    return;
                }

                lock.shared -= 1;
                if (!lock.shared) {
                    session.lockedPaths.delete(path);
                }
            });
            treePaths.forEach((path) => session.lockedTrees.delete(path));
            sharedTreePaths.forEach((path) => {
                const remaining = (session.sharedTrees.get(path) ?? 0) - 1;
                if (remaining === 0) {
                    session.sharedTrees.delete(path);
                    return;
                }

                session.sharedTrees.set(path, remaining);
            });
            this.dispatchLocks(session);
        };
    }

    private dispatchLocks(session: FtpSession): void {
        for (let index = 0; index < session.lockQueue.length;) {
            const pending = session.lockQueue[index];
            if (
                session.lockQueue
                    .slice(0, index)
                    .some((earlier) => !earlier.treePaths.length && this.lockRequestsConflict(earlier, pending))
            ) {
                index += 1;
                continue;
            }

            const release = this.tryLockPaths(
                session,
                pending.paths,
                pending.sharedPaths,
                pending.treePaths,
                pending.sharedTreePaths
            );
            if (!release) {
                index += 1;
                continue;
            }

            session.lockQueue.splice(index, 1);
            pending.resolve(release);
        }
    }

    private static logSaturatedPool(session: FtpSession, type: FtpPoolType): void {
        FtpPooledConnectionManager.LOGGER.info({
            event: LOG_EVENT.sftpPoolSaturated,
            message: "SFTP pool has waiting operations at its connection limit",
            context: `User: ${session.ownerId}, pool: ${type}, limit: ${FtpPooledConnectionManager.POOL_CONFIG[type].max}, waiting operations: ${session.pools[type].queue.length}`
        });
    }

    private static logBackgroundFailure(error: unknown): void {
        if (error instanceof ApiError) {
            return;
        }

        FtpPooledConnectionManager.LOGGER.error({
            event: backgroundFailed,
            message: "SFTP background task failed",
            error
        });
    }

    private static validateConfiguration(): void {
        const { watcher, interactive, transfer } = FtpPooledConnectionManager.POOL_CONFIG;
        const validPools = Object.values(FtpPooledConnectionManager.POOL_CONFIG).every(({ min, max }) => min <= max);
        if (
            !validPools ||
            watcher.max > 1 ||
            interactive.max > 1 ||
            transfer.max > 4 ||
            FtpPooledConnectionManager.MIN_CONNECTIONS_PER_USER > ftpMaxConnections
        ) {
            throw new ApiError({
                message: "La configuración de los pools SFTP no es válida",
                apiError: ftpConfigurationInvalid
            });
        }
    }

    private static createProtectedUserIds(): Map<string, number> {
        return new Map(
            Object.entries(protectedUsers).flatMap(([ownerId, { ftp }]) => (ftp === undefined ? [] : [[ownerId, ftp]]))
        );
    }

    private countConnections(session: FtpSession): number {
        return FTP_POOL_TYPES.reduce((total, type) => total + session.pools[type].connections.length, 0);
    }

    private isSessionIdle(session: FtpSession): boolean {
        return (
            session.transferLocks === 0 &&
            session.lockQueue.length === 0 &&
            FTP_POOL_TYPES.every((type) => {
                const pool = session.pools[type];
                return pool.queue.length === 0 && pool.connections.every((connection) => !connection.busy);
            })
        );
    }

    private isConnectionError(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        const code = "code" in error && typeof error.code === "string" ? error.code : "";
        return (
            ["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"].includes(code) ||
            /connection|socket|channel|not connected/i.test(error.message)
        );
    }

    private normalizeLockRequest(
        paths: string[],
        sharedPaths: string[],
        treePaths: string[] = [],
        sharedTreePaths: string[] = []
    ): FtpLockRequest {
        const normalizedPaths = [...new Set(paths)].sort();
        const exclusivePaths = new Set(normalizedPaths);
        return {
            paths: normalizedPaths,
            sharedPaths: [...new Set(sharedPaths)].filter((path) => !exclusivePaths.has(path)).sort(),
            treePaths: [...new Set(treePaths)].sort(),
            sharedTreePaths: [...new Set(sharedTreePaths)].sort()
        };
    }

    private lockRequestsConflict(first: FtpLockRequest, second: FtpLockRequest): boolean {
        const secondExclusive = new Set(second.paths);
        const secondShared = new Set(second.sharedPaths);
        return (
            first.sharedTreePaths.some((tree) =>
                [...second.paths, ...second.treePaths].some(
                    (path) => this.isWithinPath(path, tree) || this.isWithinPath(tree, path)
                )
            ) ||
            second.sharedTreePaths.some((tree) =>
                [...first.paths, ...first.treePaths].some(
                    (path) => this.isWithinPath(path, tree) || this.isWithinPath(tree, path)
                )
            ) ||
            first.paths.some((path) => secondExclusive.has(path) || secondShared.has(path)) ||
            first.sharedPaths.some((path) => secondExclusive.has(path)) ||
            first.treePaths.some((tree) =>
                [...second.paths, ...second.sharedPaths, ...second.treePaths].some((path) =>
                    this.isWithinPath(path, tree)
                )
            ) ||
            second.treePaths.some((tree) =>
                [...first.paths, ...first.sharedPaths, ...first.treePaths].some((path) => this.isWithinPath(tree, path))
            ) ||
            first.treePaths.some((tree) => second.paths.some((path) => this.isWithinPath(tree, path))) ||
            second.treePaths.some((tree) => first.paths.some((path) => this.isWithinPath(tree, path)))
        );
    }

    private isWithinPath(path: string, tree: string): boolean {
        return path === tree || path.startsWith(`${tree}/`) || tree === ".";
    }

    private isSessionActive(session: FtpSession): boolean {
        return !session.expired && Date.now() - session.lastActivity < ftpIdleTimeout;
    }
}
