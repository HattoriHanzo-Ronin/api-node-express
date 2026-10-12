import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FtpConnectionManager } from "../../../src/utils/connection/ftp-connection-manager.js";

const testEnvironment = vi.hoisted(() => ({
    ftpMaxConnections: 100,
    ftpMaxTransfers: 16,
    ftpIdleTimeout: 15 * 60 * 1000,
    ftpScaleWait: 5000,
    ftpProtectedUsers: ""
}));

vi.mock("../../../src/config/environment.js", () => ({ ENV: testEnvironment }));

const authUser = { id: "user-id", username: "ronin" };

describe("FtpConnectionManager", () => {
    let clients;
    let createClient;
    let closeClient;
    let manager;

    beforeEach(() => {
        Object.assign(testEnvironment, {
            ftpMaxConnections: 100,
            ftpMaxTransfers: 16,
            ftpIdleTimeout: 15 * 60 * 1000,
            ftpScaleWait: 5000,
            ftpProtectedUsers: ""
        });
        vi.useFakeTimers();
        clients = [];
        createClient = vi.fn(async () => {
            const client = { id: clients.length, end: vi.fn() };
            clients.push(client);
            return client;
        });
        closeClient = vi.fn(async (client) => client.end());
        manager = new FtpConnectionManager({ createClient, closeClient });
    });

    afterEach(async () => {
        await manager.closeAll();
        vi.useRealTimers();
    });

    it("should open one reserved connection for every pool", async () => {
        await manager.execute({ authUser, pool: "read", callback: async () => undefined });
        expect(createClient).toHaveBeenCalledTimes(3);
        expect(createClient).toHaveBeenCalledWith(authUser.username);
    });

    it("should keep operations sequential within one connection", async () => {
        await manager.execute({ authUser, pool: "read", callback: async () => undefined });
        const first = deferred();
        const calls = [];
        const firstOperation = manager.execute({
            authUser,
            pool: "internal",
            callback: async () => {
                calls.push("first");
                await first.promise;
            }
        });
        await vi.waitFor(() => expect(calls).toEqual(["first"]));
        const secondOperation = manager.execute({
            authUser,
            pool: "internal",
            callback: async () => calls.push("second")
        });
        await Promise.resolve();
        expect(calls).toEqual(["first"]);
        first.resolve();
        await Promise.all([firstOperation, secondOperation]);
        expect(calls).toEqual(["first", "second"]);
    });

    it("should immediately add a second read connection under pressure", async () => {
        const first = deferred();
        const firstOperation = manager.execute({ authUser, pool: "read", callback: () => first.promise });
        await vi.waitFor(() => expect(createClient).toHaveBeenCalledTimes(3));
        const secondOperation = manager.execute({ authUser, pool: "read", callback: async () => "second" });
        await expect(secondOperation).resolves.toBe("second");
        expect(createClient).toHaveBeenCalledTimes(4);
        first.resolve();
        await firstOperation;
    });

    it("should identify failures while scaling a pool", async () => {
        const first = deferred();
        const firstOperation = manager.execute({ authUser, pool: "read", callback: () => first.promise });
        await vi.waitFor(() => expect(createClient).toHaveBeenCalledTimes(3));
        createClient.mockRejectedValueOnce(new Error("connection failed"));
        await expect(manager.execute({
            authUser,
            pool: "read",
            callback: async () => undefined
        })).rejects.toMatchObject({ code: "FTP_POOL_SCALE_FAILED" });
        first.resolve();
        await firstOperation;
    });

    it("should scale writes after the configured queue wait up to three connections", async () => {
        const pending = [deferred(), deferred(), deferred()];
        const operations = pending.map((item) => manager.execute({
            authUser,
            pool: "write",
            callback: () => item.promise
        }));
        await vi.waitFor(() => expect(createClient).toHaveBeenCalledTimes(3));
        expect(createClient).toHaveBeenCalledTimes(3);
        await vi.advanceTimersByTimeAsync(5000);
        await vi.waitFor(() => expect(createClient).toHaveBeenCalledTimes(5));
        pending.forEach((item) => item.resolve());
        await Promise.all(operations);
    });

    it("should omit internal checks while their directory is write locked", async () => {
        const write = deferred();
        const writeOperation = manager.execute({
            authUser,
            pool: "write",
            paths: ["files"],
            callback: () => write.promise
        });
        await vi.waitFor(() => expect(createClient).toHaveBeenCalledTimes(3));
        await expect(manager.execute({
            authUser,
            pool: "internal",
            paths: ["files/photos"],
            skipLocked: true,
            callback: async () => "checked"
        })).resolves.toBeUndefined();
        write.resolve();
        await writeOperation;
    });

    it("should make a write wait for an internal check already using the directory", async () => {
        await manager.touch({ authUser });
        const check = deferred();
        const calls = [];
        const checking = manager.execute({
            authUser,
            pool: "internal",
            paths: ["files"],
            skipLocked: true,
            callback: async () => {
                calls.push("check");
                await check.promise;
            }
        });
        await vi.waitFor(() => expect(calls).toEqual(["check"]));
        const writing = manager.execute({
            authUser,
            pool: "write",
            paths: ["files/photos"],
            callback: async () => calls.push("write")
        });
        await Promise.resolve();
        expect(calls).toEqual(["check"]);
        check.resolve();
        await Promise.all([checking, writing]);
        expect(calls).toEqual(["check", "write"]);
    });

    it("should limit active transfers independently from open connections", async () => {
        await manager.closeAll();
        vi.clearAllMocks();
        manager = await createConfiguredManager({
            createClient,
            closeClient,
            environment: { ftpMaxTransfers: 1 }
        });
        const first = deferred();
        const calls = [];
        const firstTransfer = manager.execute({
            authUser,
            pool: "read",
            transfer: true,
            callback: async () => {
                calls.push("first");
                await first.promise;
            }
        });
        await vi.waitFor(() => expect(calls).toEqual(["first"]));
        const secondTransfer = manager.execute({
            authUser,
            pool: "write",
            transfer: true,
            callback: async () => calls.push("second")
        });
        await Promise.resolve();
        expect(calls).toEqual(["first"]);
        first.resolve();
        await Promise.all([firstTransfer, secondTransfer]);
        expect(calls).toEqual(["first", "second"]);
    });

    it("should identify operations cancelled by a manager shutdown", async () => {
        await manager.closeAll();
        vi.clearAllMocks();
        manager = await createConfiguredManager({
            createClient,
            closeClient,
            environment: { ftpMaxTransfers: 1 }
        });
        const first = deferred();
        const running = manager.execute({
            authUser,
            pool: "read",
            transfer: true,
            callback: () => first.promise
        });
        await vi.waitFor(() => expect(createClient).toHaveBeenCalledTimes(3));
        const queued = manager.execute({
            authUser,
            pool: "write",
            transfer: true,
            callback: async () => undefined
        });
        const rejection = expect(queued).rejects.toMatchObject({ code: "FTP_MANAGER_CLOSED" });
        await manager.closeAll();
        await rejection;
        first.resolve();
        await running;
    });

    it("should close inactive sessions only after active operations finish", async () => {
        const operation = deferred();
        const running = manager.execute({ authUser, pool: "read", callback: () => operation.promise });
        await vi.waitFor(() => expect(createClient).toHaveBeenCalledTimes(3));
        await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
        expect(closeClient).not.toHaveBeenCalled();
        operation.resolve();
        await running;
        await vi.waitFor(() => expect(closeClient).toHaveBeenCalledTimes(3));
        expect(manager.isActive({ ownerId: authUser.id })).toBe(false);
    });

    it("should retain protected base pools without keeping expanded connections", async () => {
        await manager.closeAll();
        vi.clearAllMocks();
        manager = await createConfiguredManager({
            createClient,
            closeClient,
            environment: { ftpProtectedUsers: "ronin:6" }
        });
        const first = deferred();
        const firstOperation = manager.execute({ authUser, pool: "read", callback: () => first.promise });
        await vi.waitFor(() => expect(createClient).toHaveBeenCalledTimes(3));
        await manager.execute({ authUser, pool: "read", callback: async () => undefined });
        first.resolve();
        await firstOperation;
        expect(createClient).toHaveBeenCalledTimes(4);
        await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
        await vi.waitFor(() => expect(closeClient).toHaveBeenCalledOnce());
        expect(manager.isActive({ ownerId: authUser.id })).toBe(false);
    });

    it("should reserve the configured global positions for protected users", async () => {
        await manager.closeAll();
        vi.clearAllMocks();
        manager = await createConfiguredManager({
            createClient,
            closeClient,
            environment: { ftpMaxConnections: 7, ftpProtectedUsers: "admin:4" }
        });
        const read = deferred();
        const running = manager.execute({ authUser, pool: "read", callback: () => read.promise });
        await vi.waitFor(() => expect(createClient).toHaveBeenCalledTimes(3));
        let settled = false;
        const queued = manager.execute({ authUser, pool: "read", callback: async () => "completed" })
            .finally(() => { settled = true; });
        await Promise.resolve();
        expect(settled).toBe(false);
        expect(createClient).toHaveBeenCalledTimes(3);
        read.resolve();
        await running;
        await expect(queued).resolves.toBe("completed");
        expect(createClient).toHaveBeenCalledTimes(3);
    });

    it("should renew foreground activity without acquiring another connection", async () => {
        await manager.touch({ authUser });
        expect(createClient).toHaveBeenCalledTimes(3);
        await vi.advanceTimersByTimeAsync(14 * 60 * 1000);
        await manager.touch({ authUser });
        await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
        expect(closeClient).not.toHaveBeenCalled();
        expect(manager.isActive({ ownerId: authUser.id })).toBe(true);
    });

    it("should replace a connection invalidated by a network error", async () => {
        await manager.touch({ authUser });
        await expect(manager.execute({
            authUser,
            pool: "internal",
            callback: async () => {
                const error = new Error("connection lost");
                error.code = "ECONNRESET";
                throw error;
            }
        })).rejects.toMatchObject({ code: "ECONNRESET" });
        expect(createClient).toHaveBeenCalledTimes(4);
        await expect(manager.execute({
            authUser,
            pool: "internal",
            callback: async ({ client }) => client.id
        })).resolves.toBe(3);
    });

    it("should identify failures while restoring a pool", async () => {
        await manager.touch({ authUser });
        createClient.mockRejectedValueOnce(new Error("connection failed"));
        await expect(manager.execute({
            authUser,
            pool: "internal",
            callback: async () => {
                const error = new Error("connection lost");
                error.code = "ECONNRESET";
                throw error;
            }
        })).rejects.toMatchObject({ code: "FTP_POOL_RESTORE_FAILED" });
    });

    it("should identify failures while closing a connection", async () => {
        await manager.touch({ authUser });
        closeClient.mockRejectedValue(new Error("close failed"));
        await expect(manager.closeAll()).rejects.toMatchObject({ code: "FTP_CONNECTION_CLOSE_FAILED" });
        closeClient.mockResolvedValue(undefined);
    });

    it("should reject invalid protected user reservations with an API error", async () => {
        await manager.closeAll();
        testEnvironment.ftpProtectedUsers = "ronin";
        vi.resetModules();
        await expect(import("../../../src/utils/connection/ftp-connection-manager.js")).rejects.toMatchObject({
            name: "ApiError",
            code: "FTP_CONFIGURATION_INVALID"
        });
    });
});

async function createConfiguredManager({ createClient, closeClient, environment }) {
    Object.assign(testEnvironment, environment);
    vi.resetModules();
    const { FtpConnectionManager: ConfiguredFtpConnectionManager } = await import(
        "../../../src/utils/connection/ftp-connection-manager.js"
    );
    return new ConfiguredFtpConnectionManager({ createClient, closeClient });
}

function deferred() {
    let resolve;
    const promise = new Promise((promiseResolve) => {
        resolve = promiseResolve;
    });
    return { promise, resolve };
}
