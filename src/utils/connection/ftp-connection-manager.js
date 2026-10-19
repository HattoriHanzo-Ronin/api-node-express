import FtpClient from "./ftp-client.js";
import { ENV } from "../../config/environment.js";
import { API_ERROR } from "../../config/errors.js";
import ApiError from "../error/api-error.js";

/**
 * Manages isolated SFTP connection pools per authenticated user
 *
 * @author HattoriHanzo-Ronin
 */
export class FtpConnectionManager {
    #sessions = new Map();
    #totalConnections = 0;
    #activeTransfers = 0;
    #transferQueue = [];
    #capacityQueue = [];
    #allocationTail = Promise.resolve();

    constructor({
        createClient = FtpClient.getClient,
        closeClient = FtpClient.closeClient
    } = {}) {
        this.createClient = createClient;
        this.closeClient = closeClient;
    }

    /**
     * Runs one operation with an exclusive connection from the requested pool
     *
     * @param {Object} params.authUser Authenticated user
     * @param {"internal" | "read" | "write"} params.pool Pool type
     * @param {string[]} [params.paths] Exclusively locked paths
     * @param {string[]} [params.sharedPaths] Shared locked paths
     * @param {string[]} [params.treePaths] Exclusively locked paths and their descendants
     * @param {boolean} [params.skipLocked] Whether to omit an internal operation when a path is locked
     * @param {boolean} [params.transfer] Whether the operation consumes a global transfer position
     * @param {(source: { client: import("ssh2-sftp-client") }) => Promise<*>} params.callback Operation
     * @returns {Promise<*>} Operation result, or undefined when an internal operation is omitted
     */
    async execute({ authUser, pool, paths = [], sharedPaths = [], treePaths = [], skipLocked = false, transfer = false, callback }) {
        let session = this.#sessions.get(authUser.id);
        if (pool === "internal") {
            if (!session || !this.#isActive(session)) {
                return undefined;
            }
        } else {
            session ??= await this.#getSession(authUser);
        }

        if (pool !== "internal") {
            this.#touch(session);
        }

        let releaseTransfer = () => {};
        let releasePaths = () => {};
        let connection;
        try {
            if (transfer) {
                releaseTransfer = await this.#acquireTransfer();
            }

            if (pool === "write" || pool === "read") {
                releasePaths = await this.#lockPaths(session, pool === "write" ? paths : [],
                    pool === "read" ? [...paths, ...sharedPaths] : sharedPaths, treePaths);
            }

            connection = await this.#acquire(session, pool);
            if (skipLocked) {
                const releaseInternalPaths = this.#tryLockPaths(session, paths);
                if (!releaseInternalPaths) {
                    return undefined;
                }

                releasePaths = releaseInternalPaths;
            }

            return await callback({ client: await connection.clientPromise });
        } catch (error) {
            if (connection && isConnectionError(error)) {
                await this.#removeConnection(session, pool, connection);
                connection = undefined;
                await this.#restorePool(session, pool);
            }

            throw error;
        } finally {
            if (connection) {
                this.#release(session, pool, connection);
            }

            releasePaths();
            releaseTransfer();
            if (!connection && session.expired) {
                void this.#closeSession(session);
            }
        }
    }

    /**
     * Returns whether a user session still has foreground activity
     *
     * @param {string} params.ownerId User identifier
     * @returns {boolean} Whether internal work may continue
     */
    isActive({ ownerId }) {
        const session = this.#sessions.get(ownerId);
        return Boolean(session && this.#isActive(session));
    }

    /**
     * Registers authenticated foreground activity without acquiring a connection
     *
     * @param {Object} params.authUser Authenticated user
     */
    async touch({ authUser }) {
        const session = await this.#getSession(authUser);
        this.#touch(session);
    }

    /**
     * Locks paths for the lifetime of a transfer session
     *
     * @param {Object} params.authUser Authenticated user
     * @param {string[]} params.paths Exclusively locked paths
     * @param {string[]} params.sharedPaths Shared locked paths
     * @param {string[]} params.treePaths Exclusively locked paths and their descendants
     * @returns {Promise<() => void>} Lock release function
     */
    async lockTransfer({ authUser, paths, sharedPaths, treePaths }) {
        const session = await this.#getSession(authUser);
        this.#touch(session);
        session.transferLocks += 1;
        try {
            const release = await this.#lockPaths(session, paths, sharedPaths, treePaths);
            let released = false;
            return () => {
                if (released) {
                    return;
                }

                released = true;
                release();
                session.transferLocks -= 1;
                if (session.expired) {
                    void this.#closeSession(session);
                }
            };
        } catch (error) {
            session.transferLocks -= 1;
            throw error;
        }
    }

    /**
     * Closes every managed SFTP connection
     */
    async closeAll() {
        for (const pending of this.#transferQueue.splice(0)) {
            pending.reject(new ApiError({ message: "El gestor SFTP se ha cerrado", apiError: ftpManagerClosed }));
        }
        for (const pending of this.#capacityQueue.splice(0)) {
            pending.reject(new ApiError({ message: "El gestor SFTP se ha cerrado", apiError: ftpManagerClosed }));
        }
        await Promise.all([...this.#sessions.values()].map((session) => this.#closeSession(session, true)));
    }

    #acquireTransfer() {
        if (this.#activeTransfers < MAX_TRANSFERS) {
            this.#activeTransfers += 1;
            return Promise.resolve(() => this.#releaseTransfer());
        }
        return new Promise((resolve, reject) => this.#transferQueue.push({ resolve, reject }));
    }

    #releaseTransfer() {
        const pending = this.#transferQueue.shift();
        if (pending) {
            pending.resolve(() => this.#releaseTransfer());
            return;
        }
        this.#activeTransfers -= 1;
    }

    async #getSession(authUser) {
        let session = this.#sessions.get(authUser.id);
        if (session) {
            return session;
        }

        session = {
            ownerId: authUser.id,
            lastActivity: Date.now(),
            pools: Object.fromEntries(Object.keys(POOL_CONFIG)
                .map((type) => [type, { connections: [], queue: [] }])),
            lockedPaths: new Map(),
            lockedTrees: new Set(),
            transferLocks: 0,
            lockQueue: [],
            closing: false
        };
        this.#sessions.set(authUser.id, session);
        session.initializing = Promise.allSettled(Object.keys(POOL_CONFIG)
            .map((pool) => this.#addConnection(session, pool)))
            .then((results) => {
                const rejected = results.find((result) => result.status === "rejected");
                if (rejected) {
                    throw rejected.reason;
                }
            })
            .catch(async (error) => {
                await this.#closeSession(session, true);
                throw error;
            });
        await session.initializing;
        this.#touch(session);
        return session;
    }

    async #acquire(session, type) {
        await session.initializing;
        const pool = session.pools[type];
        const connection = pool.connections.find((item) => !item.busy);
        if (connection) {
            connection.busy = true;
            return connection;
        }

        if (pool.connections.length < POOL_CONFIG[type].min) {
            const newConnection = await this.#addConnection(session, type);
            newConnection.busy = true;
            return newConnection;
        }

        return new Promise((resolve, reject) => {
            const pending = { resolve, reject };
            pool.queue.push(pending);
            if (type === "read" && pool.connections.length < POOL_CONFIG.read.max) {
                void this.#scale(session, type, pending);
            } else if (type === "write" && pool.connections.length < POOL_CONFIG.write.max) {
                pending.scaleTimeout = setTimeout(() => void this.#scale(session, type, pending), SCALE_WAIT);
                pending.scaleTimeout.unref();
            }
        });
    }

    async #scale(session, type, pending) {
        const pool = session.pools[type];
        if (!pool.queue.includes(pending)
            || pool.connections.length >= POOL_CONFIG[type].max) {
            return;
        }
        try {
            const connection = await this.#addConnection(session, type, () => pool.queue.includes(pending));
            if (connection) {
                this.#dispatch(pool, connection);
            }
        } catch {
            const index = pool.queue.indexOf(pending);
            if (index === -1) {
                return;
            }
            pool.queue.splice(index, 1);
            clearTimeout(pending.scaleTimeout);
            pending.reject(new ApiError({
                message: "No se ha podido ampliar el pool SFTP",
                apiError: ftpPoolScaleFailed
            }));
        }
    }

    #release(session, type, connection) {
        connection.busy = false;
        connection.lastUsed = Date.now();
        const pool = session.pools[type];
        this.#capacityQueue.shift()?.resolve();
        if (!this.#dispatch(pool, connection) && session.expired) {
            void this.#closeSession(session);
        }
    }

    #dispatch(pool, connection) {
        const pending = pool.queue.shift();
        if (!pending) {
            return false;
        }
        clearTimeout(pending.scaleTimeout);
        connection.busy = true;
        pending.resolve(connection);
        return true;
    }

    async #addConnection(session, type, isNeeded = () => true) {
        let releaseAllocation;
        const previousAllocation = this.#allocationTail;
        this.#allocationTail = new Promise((resolve) => { releaseAllocation = resolve; });
        await previousAllocation;
        let connection;
        try {
            if (!(await this.#ensureCapacity(session, isNeeded)) || !isNeeded()) {
                return null;
            }
            connection = {
                type,
                busy: false,
                lastUsed: Date.now(),
                clientPromise: Promise.resolve().then(() => this.createClient(session.ownerId))
            };
            session.pools[type].connections.push(connection);
            this.#totalConnections += 1;
        } finally {
            releaseAllocation();
        }
        try {
            await connection.clientPromise;
            return connection;
        } catch (error) {
            await this.#removeConnection(session, type, connection);
            throw error;
        }
    }

    async #ensureCapacity(requestSession, isNeeded) {
        while (!this.#hasCapacity(requestSession)) {
            if (!isNeeded()) {
                return false;
            }
            const candidate = this.#getEvictionCandidate(requestSession.ownerId);
            if (!candidate) {
                await new Promise((resolve, reject) => this.#capacityQueue.push({ resolve, reject }));
                continue;
            }
            if (candidate.connection) {
                await this.#removeConnection(candidate.session, candidate.type, candidate.connection);
            } else {
                await this.#closeSession(candidate.session, true);
            }
        }
        return isNeeded();
    }

    #hasCapacity(requestSession) {
        const projectedCounts = new Map();
        for (const session of this.#sessions.values()) {
            projectedCounts.set(session.ownerId, countConnections(session));
        }
        projectedCounts.set(requestSession.ownerId, (projectedCounts.get(requestSession.ownerId) ?? 0) + 1);
        const unclaimedReservations = [...PROTECTED_USER_IDS].reduce((total, [ownerId, reserved]) =>
            total + Math.max(0, reserved - (projectedCounts.get(ownerId) ?? 0)), 0);
        return this.#totalConnections + 1 + unclaimedReservations <= MAX_CONNECTIONS;
    }

    #getEvictionCandidate(excludedOwnerId) {
        const sessions = [...this.#sessions.values()];
        for (const session of sessions.sort((a, b) => a.lastActivity - b.lastActivity)) {
            for (const type of ["write", "read"]) {
                const pool = session.pools[type];
                const minimum = POOL_CONFIG[type].min;
                const connection = pool.connections.find((item, index) => index >= minimum && !item.busy);
                if (connection) {
                    return { session, type, connection };
                }
            }
        }
        return sessions
            .filter((session) => session.ownerId !== excludedOwnerId)
            .filter((session) => !PROTECTED_USER_IDS.has(session.ownerId) && isSessionIdle(session))
            .map((session) => ({ session }))
            .at(0);
    }

    async #removeConnection(session, type, connection) {
        const pool = session.pools[type];
        const index = pool.connections.indexOf(connection);
        if (index === -1) {
            return;
        }
        pool.connections.splice(index, 1);
        this.#totalConnections -= 1;
        this.#capacityQueue.shift()?.resolve();
        const result = await Promise.allSettled([connection.clientPromise]);
        if (result[0].status === "rejected") {
            return;
        }
        try {
            await this.closeClient(result[0].value);
        } catch {
            throw new ApiError({
                message: "No se ha podido cerrar la conexión SFTP",
                apiError: ftpConnectionCloseFailed
            });
        }
    }

    async #restorePool(session, type) {
        if (session.closing || session.expired) {
            return;
        }
        const pool = session.pools[type];
        if (pool.connections.length >= POOL_CONFIG[type].min && !pool.queue.length) {
            return;
        }
        try {
            const connection = await this.#addConnection(session, type);
            this.#dispatch(pool, connection);
        } catch {
            throw new ApiError({
                message: "No se ha podido restaurar el pool SFTP",
                apiError: ftpPoolRestoreFailed
            });
        }
    }

    #touch(session) {
        session.lastActivity = Date.now();
        session.expired = false;
        clearTimeout(session.idleTimeout);
        session.idleTimeout = setTimeout(() => void this.#expire(session), IDLE_TIMEOUT);
        session.idleTimeout.unref();
    }

    async #expire(session) {
        session.expired = true;
        if (!isSessionIdle(session)) {
            return;
        }
        if (PROTECTED_USER_IDS.has(session.ownerId)) {
            await this.#trimProtectedSession(session);
            return;
        }
        await this.#closeSession(session, true);
    }

    async #trimProtectedSession(session) {
        for (const type of ["read", "write"]) {
            const pool = session.pools[type];
            while (pool.connections.length > POOL_CONFIG[type].min) {
                await this.#removeConnection(session, type, pool.connections.at(-1));
            }
        }
    }

    async #closeSession(session, force = false) {
        if (session.closing || (!force && !isSessionIdle(session))) {
            return;
        }
        session.closing = true;
        clearTimeout(session.idleTimeout);
        this.#sessions.delete(session.ownerId);
        for (const pool of Object.values(session.pools)) {
            for (const pending of pool.queue.splice(0)) {
                clearTimeout(pending.scaleTimeout);
                pending.reject(new ApiError({ message: "La sesión SFTP se ha cerrado", apiError: ftpSessionClosed }));
            }
        }
        for (const pending of session.lockQueue.splice(0)) {
            pending.reject(new ApiError({ message: "La sesión SFTP se ha cerrado", apiError: ftpSessionClosed }));
        }
        await Promise.all(Object.entries(session.pools).flatMap(([type, pool]) =>
            [...pool.connections].map((connection) => this.#removeConnection(session, type, connection))
        ));
    }

    async #lockPaths(session, paths, sharedPaths, treePaths) {
        const request = normalizeLockRequest(paths, sharedPaths, treePaths);
        const queuedRequest = {
            ...request,
            sharedPaths: request.sharedPaths.filter((path) => !session.lockedPaths.get(path)?.shared)
        };
        const release = !session.lockQueue.some((pending) => !pending.treePaths.length && lockRequestsConflict(queuedRequest, pending))
            && this.#tryLockPaths(session, request.paths, request.sharedPaths, request.treePaths);
        if (release) {
            return release;
        }

        return new Promise((resolve, reject) => session.lockQueue.push({ ...request, resolve, reject }));
    }

    #tryLockPaths(session, paths, sharedPaths = [], treePaths = []) {
        if (paths.some((path) => session.lockedPaths.has(path))
            || sharedPaths.some((path) => session.lockedPaths.get(path)?.exclusive)
            || [...paths, ...sharedPaths, ...treePaths].some((path) =>
                [...session.lockedTrees].some((tree) => isWithinPath(path, tree)))
            || paths.some((path) => [...session.lockedTrees].some((tree) => isWithinPath(tree, path)))
            || treePaths.some((tree) => [...session.lockedPaths.keys(), ...session.lockedTrees]
                .some((path) => isWithinPath(path, tree) ||
                    (session.lockedPaths.get(path)?.exclusive && isWithinPath(tree, path))))) {
            return null;
        }

        paths.forEach((path) => session.lockedPaths.set(path, { exclusive: true, shared: 0 }));
        sharedPaths.forEach((path) => {
            const lock = session.lockedPaths.get(path) ?? { exclusive: false, shared: 0 };
            lock.shared += 1;
            session.lockedPaths.set(path, lock);
        });
        treePaths.forEach((path) => session.lockedTrees.add(path));
        return () => {
            paths.forEach((path) => session.lockedPaths.delete(path));
            sharedPaths.forEach((path) => {
                const lock = session.lockedPaths.get(path);
                lock.shared -= 1;
                if (!lock.shared) {
                    session.lockedPaths.delete(path);
                }
            });
            treePaths.forEach((path) => session.lockedTrees.delete(path));
            this.#dispatchLocks(session);
        };
    }

    #dispatchLocks(session) {
        for (let index = 0; index < session.lockQueue.length;) {
            const pending = session.lockQueue[index];
            if (session.lockQueue.slice(0, index).some((earlier) => !earlier.treePaths.length && lockRequestsConflict(earlier, pending))) {
                index += 1;
                continue;
            }

            const release = this.#tryLockPaths(session, pending.paths, pending.sharedPaths, pending.treePaths);
            if (!release) {
                index += 1;
                continue;
            }

            session.lockQueue.splice(index, 1);
            pending.resolve(release);
        }
    }

    #isActive(session) {
        return !session.expired && Date.now() - session.lastActivity < IDLE_TIMEOUT;
    }
}

function parseProtectedUserIds(source) {
    return new Map(source.split(",").filter(Boolean).map((entry) => {
        const [ownerId, reservedSource] = entry.trim().split(":");
        const reserved = Number(reservedSource);
        if (!ownerId || !Number.isInteger(reserved)
            || reserved < MIN_CONNECTIONS_PER_USER || reserved > MAX_CONNECTIONS_PER_USER) {
            throw new ApiError({
                message: `Reserva SFTP no válida: ${entry}`,
                apiError: ftpConfigurationInvalid
            });
        }

        return [ownerId, reserved];
    }));
}

function validateConfiguration() {
    const validPools = Object.values(POOL_CONFIG).every(({ min, max }) => min <= max);
    if (!validPools || MIN_CONNECTIONS_PER_USER > MAX_CONNECTIONS) {
        throw new ApiError({
            message: "La configuración de los pools SFTP no es válida",
            apiError: ftpConfigurationInvalid
        });
    }
}

function countConnections(session) {
    return Object.values(session.pools).reduce((total, pool) => total + pool.connections.length, 0);
}

function isSessionIdle(session) {
    return session.transferLocks === 0 && session.lockQueue.length === 0 && Object.values(session.pools).every((pool) =>
        pool.queue.length === 0 && pool.connections.every((connection) => !connection.busy)
    );
}

function isConnectionError(error) {
    return ["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"].includes(error?.code)
        || /connection|socket|channel|not connected/i.test(error?.message ?? "");
}

function normalizeLockRequest(paths, sharedPaths, treePaths = []) {
    const normalizedPaths = [...new Set(paths)].sort();
    const exclusivePaths = new Set(normalizedPaths);
    return {
        paths: normalizedPaths,
        sharedPaths: [...new Set(sharedPaths)].filter((path) => !exclusivePaths.has(path)).sort(),
        treePaths: [...new Set(treePaths)].sort()
    };
}

function lockRequestsConflict(first, second) {
    const secondExclusive = new Set(second.paths);
    const secondShared = new Set(second.sharedPaths);
    return first.paths.some((path) => secondExclusive.has(path) || secondShared.has(path))
        || first.sharedPaths.some((path) => secondExclusive.has(path))
        || first.treePaths.some((tree) => [...second.paths, ...second.sharedPaths, ...second.treePaths]
            .some((path) => isWithinPath(path, tree)))
        || second.treePaths.some((tree) => [...first.paths, ...first.sharedPaths, ...first.treePaths]
            .some((path) => isWithinPath(path, tree)))
        || first.treePaths.some((tree) => second.paths.some((path) => isWithinPath(tree, path)))
        || second.treePaths.some((tree) => first.paths.some((path) => isWithinPath(tree, path)));
}

function isWithinPath(path, tree) {
    return path === tree || path.startsWith(`${tree}/`) || tree === ".";
}

const {
    ftpMaxConnections: MAX_CONNECTIONS,
    ftpMaxTransfers: MAX_TRANSFERS,
    ftpIdleTimeout: IDLE_TIMEOUT,
    ftpScaleWait: SCALE_WAIT,
    ftpProtectedUserIds: PROTECTED_USER_IDS_SOURCE,
    ftpInternalPoolMin: INTERNAL_POOL_MIN,
    ftpInternalPoolMax: INTERNAL_POOL_MAX,
    ftpReadPoolMin: READ_POOL_MIN,
    ftpReadPoolMax: READ_POOL_MAX,
    ftpWritePoolMin: WRITE_POOL_MIN,
    ftpWritePoolMax: WRITE_POOL_MAX
} = ENV;
const {
    ftpConfigurationInvalid,
    ftpConnectionCloseFailed,
    ftpManagerClosed,
    ftpPoolRestoreFailed,
    ftpPoolScaleFailed,
    ftpSessionClosed
} = API_ERROR;
const POOL_CONFIG = Object.freeze({
    internal: { min: INTERNAL_POOL_MIN, max: INTERNAL_POOL_MAX },
    read: { min: READ_POOL_MIN, max: READ_POOL_MAX },
    write: { min: WRITE_POOL_MIN, max: WRITE_POOL_MAX }
});
const MIN_CONNECTIONS_PER_USER = Object.values(POOL_CONFIG).reduce((total, { min }) => total + min, 0);
const MAX_CONNECTIONS_PER_USER = Object.values(POOL_CONFIG).reduce((total, { max }) => total + max, 0);
validateConfiguration();
const PROTECTED_USER_IDS = parseProtectedUserIds(PROTECTED_USER_IDS_SOURCE);
const RESERVED_CONNECTIONS = [...PROTECTED_USER_IDS.values()].reduce((total, reserved) => total + reserved, 0);

if (RESERVED_CONNECTIONS > MAX_CONNECTIONS) {
    throw new ApiError({
        message: "Las reservas SFTP superan el límite global de conexiones",
        apiError: ftpConfigurationInvalid
    });
}

export default new FtpConnectionManager();
