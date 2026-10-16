import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemoryCache from "../../src/utils/cache/memory-cache.js";
import DirectoryCache from "../../src/utils/cache/directory-cache.js";
import FtpFacade from "../../src/facades/ftp-facade.js";
import FtpMapper from "../../src/mappers/ftp-mapper.js";

vi.mock("../../src/config/environment.js", () => ({
    ENV: {
        memoryCacheMaxSize: 2 * 1024 ** 3,
        memoryCacheMaxSizePerOwner: 400 * 1024 ** 2,
        memoryCacheInactivityTimeout: 10 * 60 * 1000,
        directoryCacheInactivityTimeout: 10 * 60 * 1000,
        ftpDirectoryCheckTimeout: 5000
    }
}));

describe("FtpFacade", () => {
    let ftpService;
    let memoryCache;
    let directoryCache;
    let ftpFacade;

    beforeEach(() => {
        vi.useFakeTimers();
        ftpService = {
            dir: vi.fn(),
            isSessionActive: vi.fn(() => true),
            touchSession: vi.fn(),
            getThumbnails: vi.fn(),
            streamMedia: vi.fn(),
            makeDir: vi.fn(),
            move: vi.fn(),
            rename: vi.fn(),
            createUpload: vi.fn(),
            upload: vi.fn(),
            completeUpload: vi.fn(),
            cancelTransfer: vi.fn(),
            createDownload: vi.fn(),
            download: vi.fn(),
            delete: vi.fn()
        };
        ftpService.dir.mockResolvedValue([]);
        ftpService.getThumbnails.mockResolvedValue(undefined);
        memoryCache = new MemoryCache();
        directoryCache = new DirectoryCache();
        ftpFacade = new FtpFacade({
            ftpService,
            ftpMapper: FtpMapper,
            memoryCache,
            directoryCache
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("read operations", () => {
        it("should delegate temporary media streams", async () => {
            const data = { id: "media-id", range: "bytes=0-99", method: "GET", stream: new PassThrough() };
            await ftpFacade.streamMedia(data);
            expect(ftpService.streamMedia).toHaveBeenCalledWith(data);
        });

        it("should return a cached directory hash", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            directoryCache.set(authUser.id, "files", { hash: "directory-hash" });
            await expect(ftpFacade.getHash({ dir: "files", authUser })).resolves.toBe("directory-hash");
            expect(ftpService.touchSession).toHaveBeenCalledWith({ authUser });
            expect(ftpService.dir).not.toHaveBeenCalled();
        });

        it("should rebuild a directory hash when it is not cached", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            ftpService.dir.mockResolvedValue([
                { name: "photo.jpg", type: "FILE", size: 100, modifyTime: "2026-09-20T10:00:00.000Z" }
            ]);
            await expect(ftpFacade.getHash({ dir: "files", authUser })).resolves.toEqual(expect.any(String));
            expect(ftpService.dir).toHaveBeenCalledWith({ dir: "files", authUser });
            expect(directoryCache.has(authUser.id, "files")).toBe(true);
        });

        it("should return thumbnail candidates before caching their generated buffers", async () => {
            const data = { dir: "files", authUser: { id: "user-id", username: "ronin" } };
            const entries = [
                { name: "folder", type: "DIR", supportsThumbnail: false },
                { name: "photo.jpg", type: "FILE", supportsThumbnail: true },
                { name: "notes.txt", type: "FILE", supportsThumbnail: false }
            ];
            let resolveThumbnails;
            ftpService.dir.mockResolvedValue(entries);
            ftpService.getThumbnails.mockImplementation(({ callback }) => new Promise((resolve) => {
                resolveThumbnails = async (thumbnail) => {
                    await callback({ name: "photo.jpg", thumbnail });
                    resolve();
                };
            }));
            await expect(ftpFacade.dir(data)).resolves.toEqual({
                hash: expect.any(String),
                data: [
                    { name: "folder", type: "DIR" },
                    { name: "photo.jpg", type: "FILE", supportsThumbnail: true },
                    { name: "notes.txt", type: "FILE", supportsThumbnail: false }
                ]
            });
            expect(memoryCache.get("user-id", "files")).toEqual(new Map());
            expect(ftpService.getThumbnails).toHaveBeenCalledWith({
                ...data,
                names: ["photo.jpg"],
                callback: expect.any(Function)
            });
            await expect(ftpFacade.getThumbnail({ dir: data.dir, name: "photo.jpg", authUser: data.authUser })).rejects.toMatchObject({
                code: "FTP_THUMBNAIL_PENDING"
            });
            expect(ftpService.getThumbnails).toHaveBeenCalledOnce();
            await resolveThumbnails(Buffer.from("thumbnail"));
            await Promise.resolve();
            await Promise.resolve();
            await expect(ftpFacade.getThumbnail({ dir: data.dir, name: "photo.jpg", authUser: data.authUser })).resolves.toEqual(Buffer.from("thumbnail"));
        });

        it("should update the directory hash every five seconds without exposing its metadata", async () => {
            const data = { dir: "files", authUser: { id: "user-id", username: "ronin" } };
            ftpService.dir
                .mockResolvedValueOnce([
                    { name: "photo.jpg", type: "FILE", size: 100, modifyTime: "2026-09-20T10:00:00.000Z", supportsThumbnail: true }
                ])
                .mockResolvedValueOnce([
                    { name: "photo.jpg", type: "FILE", size: 200, modifyTime: "2026-09-20T10:01:00.000Z", supportsThumbnail: true }
                ]);
            await expect(ftpFacade.dir(data)).resolves.toEqual({
                hash: expect.any(String),
                data: [{ name: "photo.jpg", type: "FILE", supportsThumbnail: true }]
            });
            const initialHash = directoryCache.get("user-id", "files").hash;
            await vi.advanceTimersByTimeAsync(5000);
            expect(ftpService.dir).toHaveBeenCalledTimes(2);
            expect(directoryCache.get("user-id", "files")).toEqual({
                hash: expect.not.stringMatching(initialHash)
            });
        });

        it("should synchronize cached thumbnails with external directory changes", async () => {
            const data = { dir: "files", authUser: { id: "user-id", username: "ronin" } };
            ftpService.dir.mockResolvedValueOnce([
                { name: "old.jpg", type: "FILE", supportsThumbnail: true },
                { name: "removed.jpg", type: "FILE", supportsThumbnail: true },
                { name: "notes.txt", type: "FILE", supportsThumbnail: false }
            ]);
            ftpService.getThumbnails.mockImplementation(async ({ names, callback }) => {
                for (const name of names) {
                    await callback({ name, thumbnail: Buffer.from(name) });
                }
            });
            await ftpFacade.dir(data);
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            ftpService.dir.mockResolvedValueOnce([
                { name: "old.jpg", type: "FILE", supportsThumbnail: true },
                { name: "new.jpg", type: "FILE", supportsThumbnail: true },
                { name: "notes.txt", type: "FILE", supportsThumbnail: false }
            ]);
            await expect(ftpFacade.dir(data)).resolves.toEqual({
                hash: expect.any(String),
                data: [
                    { name: "old.jpg", type: "FILE", supportsThumbnail: true },
                    { name: "new.jpg", type: "FILE", supportsThumbnail: true },
                    { name: "notes.txt", type: "FILE", supportsThumbnail: false }
                ]
            });
            await Promise.resolve();
            await Promise.resolve();
            expect(ftpService.getThumbnails).toHaveBeenLastCalledWith({
                ...data,
                names: ["new.jpg"],
                callback: expect.any(Function)
            });
            expect(memoryCache.get("user-id", "files").has("removed.jpg")).toBe(false);
            expect(memoryCache.get("user-id", "files").has("notes.txt")).toBe(false);
        });

        it("should reuse the same thumbnail cache and regenerate it after deletion", async () => {
            const data = { dir: "files", authUser: { id: "user-id", username: "ronin" } };
            ftpService.dir.mockResolvedValue([{ name: "photo.jpg", type: "FILE", supportsThumbnail: true }]);
            ftpService.getThumbnails.mockImplementation(async ({ names, callback }) => {
                for (const name of names) {
                    await callback({ name, thumbnail: Buffer.from("thumbnail") });
                }
            });
            await ftpFacade.dir(data);
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(10 * 60 * 1000 - 1);
            await ftpFacade.dir(data);
            expect(ftpService.getThumbnails).toHaveBeenCalledOnce();
            await expect(ftpFacade.getThumbnail({ dir: data.dir, name: "photo.jpg", authUser: data.authUser })).resolves.toEqual(Buffer.from("thumbnail"));
            memoryCache.delete("user-id", "files");
            let resolveThumbnails;
            ftpService.getThumbnails.mockImplementationOnce(({ callback }) => new Promise((resolve) => {
                resolveThumbnails = async (thumbnail) => {
                    await callback({ name: "photo.jpg", thumbnail });
                    resolve();
                };
            }));
            await expect(ftpFacade.getThumbnail({ dir: data.dir, name: "photo.jpg", authUser: data.authUser })).rejects.toMatchObject({
                code: "FTP_THUMBNAIL_PENDING"
            });
            await resolveThumbnails(Buffer.from("thumbnail"));
            await Promise.resolve();
            await Promise.resolve();
            await expect(ftpFacade.getThumbnail({ dir: data.dir, name: "photo.jpg", authUser: data.authUser })).resolves.toEqual(Buffer.from("thumbnail"));
            expect(ftpService.getThumbnails).toHaveBeenCalledTimes(2);
        });

        it("should return thumbnails from the requested cached directory", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            ftpService.getThumbnails.mockImplementation(async ({ names, callback }) => {
                for (const name of names) {
                    await callback({ name, thumbnail: Buffer.from(name.split(".")[0]) });
                }
            });
            ftpService.dir.mockResolvedValueOnce([{ name: "first.jpg", type: "FILE", supportsThumbnail: true }]);
            await ftpFacade.dir({ dir: "first", authUser });
            await Promise.resolve();
            ftpService.dir.mockResolvedValueOnce([{ name: "second.jpg", type: "FILE", supportsThumbnail: true }]);
            await ftpFacade.dir({ dir: "second", authUser });
            await Promise.resolve();
            await expect(ftpFacade.getThumbnail({ dir: "first", name: "first.jpg", authUser })).resolves.toEqual(Buffer.from("first"));
            await expect(ftpFacade.getThumbnail({ dir: "second", name: "second.jpg", authUser })).resolves.toEqual(Buffer.from("second"));
        });

        it("should return null when the file has no generated thumbnail", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            ftpService.dir.mockResolvedValue([{ name: "photo.jpg", type: "FILE", supportsThumbnail: true }]);
            ftpService.getThumbnails.mockImplementation(async ({ names, callback }) => {
                for (const name of names) {
                    await callback({ name, thumbnail: null });
                }
            });
            await ftpFacade.dir({ dir: "files", authUser });
            await Promise.resolve();
            expect(memoryCache.get("user-id", "files").get("photo.jpg")).toBeNull();
            await expect(ftpFacade.getThumbnail({ dir: "files", name: "photo.jpg", authUser })).resolves.toBeNull();
        });

        it("should create download sessions", async () => {
            const data = { dir: "files", entries: [], authUser: { username: "ronin" } };
            ftpService.createDownload.mockResolvedValue({ id: "download-id", entries: [] });
            await expect(ftpFacade.createDownload(data)).resolves.toEqual({ id: "download-id", entries: [] });
            expect(ftpService.createDownload).toHaveBeenCalledWith(data);
        });

        it("should download individual session files", async () => {
            const data = { id: "download-id", entryPath: "docs/file.txt", stream: new PassThrough() };
            await ftpFacade.downloadEntry(data);
            expect(ftpService.download).toHaveBeenCalledWith(data);
        });
    });

    describe("write operations", () => {
        it.each([
            ["makeDir", { name: "docs", type: "DIR" }, { dir: "files", name: "docs" }],
            ["rename", { name: "renamed.txt", type: "FILE" }, {
                dir: "files",
                entry: { name: "file.txt", type: "FILE" },
                newName: "renamed.txt"
            }]
        ])("should execute %s and return its synchronized directory", async (method, result, methodData) => {
            const authUser = { id: "user-id", username: "ronin" };
            const data = { ...methodData, authUser };
            ftpService[method].mockResolvedValue(result);
            await expect(ftpFacade[method](data)).resolves.toEqual({ hash: expect.any(String), data: [] });
            expect(ftpService[method]).toHaveBeenCalledWith(data);
            expect(ftpService.dir).toHaveBeenCalledWith({ dir: "files", authUser });
        });

        it("should synchronize the directory when an upload completes", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            ftpService.completeUpload.mockResolvedValue({ dir: "files" });
            await expect(ftpFacade.completeUpload({ id: "upload-id", authUser })).resolves.toEqual({
                hash: expect.any(String),
                data: []
            });
            expect(ftpService.dir).toHaveBeenCalledWith({ dir: "files", authUser });
        });

        it("should stream moved entries and relocate folder caches", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            const thumbnail = new Map([["photo.jpg", Buffer.from("thumbnail")]]);
            const directory = { hash: "hash" };
            memoryCache.set("user-id", "source/photos", thumbnail);
            directoryCache.set("user-id", "source/photos", directory);
            const entries = [{ name: "photos", type: "DIR" }];
            ftpService.move.mockImplementation(async ({ onEntry }) => {
                await onEntry(entries[0], "moved-photos");
            });
            const stream = new PassThrough();
            let headersSent = false;
            Object.defineProperty(stream, "headersSent", { get: () => headersSent });
            stream.set = vi.fn(() => {
                headersSent = true;
            });
            await ftpFacade.move({ dir: "source", destination: "destination", entries, authUser, stream });
            expect(stream.set).toHaveBeenCalledOnce();
            expect(stream.set).toHaveBeenCalledWith({
                "Cache-Control": "no-cache, no-transform",
                "Content-Type": "application/x-ndjson",
                "X-Accel-Buffering": "no"
            });
            expect(readEvents(stream)).toEqual([{
                event: "entry",
                path: "photos",
                targetPath: "moved-photos",
                type: "DIR",
                completed: 1,
                total: 1
            }, { event: "complete", version: expect.any(String) }]);
            expect(ftpService.dir).toHaveBeenCalledWith({ dir: "destination", authUser });
            expect(memoryCache.get("user-id", "source/photos")).toBeUndefined();
            expect(memoryCache.get("user-id", "destination/moved-photos")).toBe(thumbnail);
            expect(directoryCache.has("user-id", "source/photos")).toBe(false);
            expect(directoryCache.get("user-id", "destination/moved-photos")).toEqual(directory);
        });

        it("should delete renamed folder caches", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            const directory = { hash: "hash" };
            const bufferMap = new Map();
            memoryCache.set("user-id", "files/photos", bufferMap);
            directoryCache.set("user-id", "files/photos", directory);
            ftpService.rename.mockResolvedValue({ name: "renamed", type: "DIR" });
            ftpService.dir.mockResolvedValue([{ name: "renamed", type: "DIR" }]);
            await ftpFacade.rename({
                dir: "files",
                entry: { name: "photos", type: "DIR" },
                newName: "renamed",
                authUser
            });
            expect(memoryCache.has("user-id", "files/photos")).toBe(false);
            expect(memoryCache.get("user-id", "files/renamed")).toBe(bufferMap);
            expect(directoryCache.has("user-id", "files/photos")).toBe(false);
            expect(directoryCache.get("user-id", "files/renamed")).toEqual(directory);
            expect(ftpService.dir).toHaveBeenCalledWith({ dir: "files", authUser });
        });

        it("should stream deleted entries and clear folder caches", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            const directory = { hash: "hash" };
            memoryCache.set("user-id", "files/photos", new Map());
            directoryCache.set("user-id", "files/photos", directory);
            const entries = [{ name: "photos", type: "DIR" }];
            ftpService.delete.mockImplementation(async ({ onEntry }) => {
                await onEntry(entries[0]);
            });
            const stream = new PassThrough();
            await ftpFacade.delete({ dir: "files", entries, authUser, stream });
            expect(readEvents(stream)).toEqual([{
                event: "entry",
                path: "photos",
                type: "DIR",
                completed: 1,
                total: 1
            }, { event: "complete", version: expect.any(String) }]);
            expect(ftpService.dir).toHaveBeenCalledWith({ dir: "files", authUser });
            expect(memoryCache.has("user-id", "files/photos")).toBe(false);
            expect(directoryCache.has("user-id", "files/photos")).toBe(false);
        });

        it("should omit the complete event after a partial failure", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            const entries = [
                { name: "first.txt", type: "FILE" },
                { name: "second.txt", type: "FILE" }
            ];
            directoryCache.set("user-id", "files", { hash: "old-hash" });
            ftpService.delete.mockImplementation(async ({ onEntry }) => {
                await onEntry(entries[0]);
                throw new Error("FTP error");
            });
            const stream = new PassThrough();
            await expect(ftpFacade.delete({ dir: "files", entries, authUser, stream })).rejects.toThrow("FTP error");
            expect(readEvents(stream)).toEqual([{
                event: "entry",
                path: "first.txt",
                type: "FILE",
                completed: 1,
                total: 2
            }]);
            expect(directoryCache.has("user-id", "files")).toBe(false);
            expect(ftpService.dir).not.toHaveBeenCalled();
        });

        it("should propagate write errors", async () => {
            const stream = new PassThrough();
            stream.set = vi.fn();
            const data = { authUser: { username: "ronin" }, stream };
            ftpService.delete.mockRejectedValue(new Error("FTP error"));
            await expect(ftpFacade.delete(data)).rejects.toThrow("FTP error");
            expect(stream.set).not.toHaveBeenCalled();
        });
    });
});

function readEvents(stream) {
    return stream.read().toString().trim().split("\n").map((it) => JSON.parse(it));
}
