import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemoryCache from "../../src/utils/cache/memory-cache.js";
import DirectoryCache from "../../src/utils/cache/directory-cache.js";
import FtpFacade from "../../src/facades/ftp-facade.js";
import FtpMapper from "../../src/mappers/ftp-mapper.js";

describe("FtpFacade", () => {
    let ftpService;
    let memoryCache;
    let directoryCache;
    let ftpFacade;

    beforeEach(() => {
        vi.useFakeTimers();
        ftpService = {
            dir: vi.fn(),
            getThumbnails: vi.fn(),
            makeDir: vi.fn(),
            move: vi.fn(),
            rename: vi.fn(),
            upload: vi.fn(),
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
        it("should return a cached directory hash", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            directoryCache.set(authUser.id, "/files", { username: authUser.username, hash: "directory-hash" });
            await expect(ftpFacade.getHash({ dir: "/files", authUser })).resolves.toBe("directory-hash");
            expect(ftpService.dir).not.toHaveBeenCalled();
        });

        it("should rebuild a directory hash when it is not cached", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            ftpService.dir.mockResolvedValue([
                { name: "photo.jpg", type: "FILE", size: 100, modifyTime: "2026-09-20T10:00:00.000Z" }
            ]);
            await expect(ftpFacade.getHash({ dir: "/files", authUser })).resolves.toEqual(expect.any(String));
            expect(ftpService.dir).toHaveBeenCalledWith({ dir: "/files", authUser });
            expect(directoryCache.has(authUser.id, "/files")).toBe(true);
        });

        it("should return thumbnail candidates before caching their generated buffers", async () => {
            const data = { dir: "/files", authUser: { id: "user-id", username: "ronin" } };
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
            expect(memoryCache.get("user-id", "/files")).toEqual(new Map());
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
            const data = { dir: "/files", authUser: { id: "user-id", username: "ronin" } };
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
            const initialHash = directoryCache.get("user-id", "/files").hash;
            await vi.advanceTimersByTimeAsync(5000);
            expect(ftpService.dir).toHaveBeenCalledTimes(2);
            expect(directoryCache.get("user-id", "/files")).toEqual({
                username: "ronin",
                hash: expect.not.stringMatching(initialHash)
            });
        });

        it("should synchronize cached thumbnails with external directory changes", async () => {
            const data = { dir: "/files", authUser: { id: "user-id", username: "ronin" } };
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
            expect(memoryCache.get("user-id", "/files").has("removed.jpg")).toBe(false);
            expect(memoryCache.get("user-id", "/files").has("notes.txt")).toBe(false);
        });

        it("should reuse the same thumbnail cache and regenerate it after deletion", async () => {
            const data = { dir: "/files", authUser: { id: "user-id", username: "ronin" } };
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
            memoryCache.delete("user-id", "/files");
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
            await ftpFacade.dir({ dir: "/first", authUser });
            await Promise.resolve();
            ftpService.dir.mockResolvedValueOnce([{ name: "second.jpg", type: "FILE", supportsThumbnail: true }]);
            await ftpFacade.dir({ dir: "/second", authUser });
            await Promise.resolve();
            await expect(ftpFacade.getThumbnail({ dir: "/first", name: "first.jpg", authUser })).resolves.toEqual(Buffer.from("first"));
            await expect(ftpFacade.getThumbnail({ dir: "/second", name: "second.jpg", authUser })).resolves.toEqual(Buffer.from("second"));
        });

        it("should return null when the file has no generated thumbnail", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            ftpService.dir.mockResolvedValue([{ name: "photo.jpg", type: "FILE", supportsThumbnail: true }]);
            ftpService.getThumbnails.mockImplementation(async ({ names, callback }) => {
                for (const name of names) {
                    await callback({ name, thumbnail: null });
                }
            });
            await ftpFacade.dir({ dir: "/files", authUser });
            await Promise.resolve();
            expect(memoryCache.get("user-id", "/files").get("photo.jpg")).toBeNull();
            await expect(ftpFacade.getThumbnail({ dir: "/files", name: "photo.jpg", authUser })).resolves.toBeNull();
        });

        it("should download resources", async () => {
            const stream = { type: vi.fn().mockReturnThis(), attachment: vi.fn().mockReturnThis() };
            const data = {
                dir: "/files",
                entries: [{ name: "file.txt", type: "FILE" }],
                authUser: { username: "ronin" },
                stream
            };
            await expect(ftpFacade.download(data)).resolves.toBeUndefined();
            expect(stream.type).toHaveBeenCalledWith("file.txt");
            expect(stream.attachment).toHaveBeenCalledWith("file.txt");
            expect(ftpService.download).toHaveBeenCalledWith(data);
        });

        it("should enrich directory downloads as ZIP files", async () => {
            vi.spyOn(Date, "now").mockReturnValue(1783417469000);
            const stream = { type: vi.fn().mockReturnThis(), attachment: vi.fn().mockReturnThis() };
            const data = {
                dir: "/files",
                entries: [{ name: "docs", type: "DIR" }],
                authUser: { username: "ronin" },
                stream
            };
            await ftpFacade.download(data);
            expect(stream.type).toHaveBeenCalledWith("application/zip");
            expect(stream.attachment).toHaveBeenCalledWith("download-1783417469000.zip");
            expect(ftpService.download).toHaveBeenCalledWith(data);
        });
    });

    describe("write operations", () => {
        it.each([
            ["makeDir", { name: "docs", type: "DIR" }, "/files"],
            ["move", { lastContent: [], movedContent: [] }, "/destination"],
            ["rename", { name: "file.txt", type: "FILE" }, "/files"],
            ["upload", [{ name: "file.txt", type: "FILE" }], "/files"],
            ["delete", ["file.txt"], "/files"]
        ])("should execute %s and return its synchronized directory", async (method, result, expectedDir) => {
            const data = {
                dir: "/files",
                destination: "/destination",
                entry: { name: "file.txt", type: "FILE" },
                entries: [],
                authUser: { id: "user-id", username: "ronin" }
            };
            ftpService[method].mockResolvedValue(result);
            await expect(ftpFacade[method](data)).resolves.toEqual({ hash: expect.any(String), data: [] });
            expect(ftpService[method]).toHaveBeenCalledWith(data);
            expect(ftpService.dir).toHaveBeenCalledWith({ dir: expectedDir, authUser: data.authUser });
        });

        it("should delete moved folder caches and return the destination directory", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            const thumbnail = new Map([["photo.jpg", Buffer.from("thumbnail")]]);
            const directory = { username: "ronin", hash: "hash" };
            memoryCache.set("user-id", "/source/photos", thumbnail);
            directoryCache.set("user-id", "/source/photos", directory);
            const entries = [{ name: "photos", type: "DIR" }];
            ftpService.move.mockResolvedValue({
                lastContent: ["photos"],
                movedContent: [{ name: "moved-photos", type: "DIR" }]
            });
            ftpService.dir.mockResolvedValue([{ name: "moved-photos", type: "DIR" }]);
            await expect(
                ftpFacade.move({ dir: "/source", destination: "/destination", entries, authUser })
            ).resolves.toEqual({ hash: expect.any(String), data: [{ name: "moved-photos", type: "DIR" }] });
            expect(memoryCache.get("user-id", "/source/photos")).toBeUndefined();
            expect(memoryCache.get("user-id", "/destination/moved-photos")).toBe(thumbnail);
            expect(directoryCache.has("user-id", "/source/photos")).toBe(false);
            expect(directoryCache.get("user-id", "/destination/moved-photos")).toEqual(directory);
        });

        it("should delete renamed folder caches", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            const directory = { username: "ronin", hash: "hash" };
            const bufferMap = new Map();
            memoryCache.set("user-id", "/files/photos", bufferMap);
            directoryCache.set("user-id", "/files/photos", directory);
            ftpService.rename.mockResolvedValue({ name: "renamed", type: "DIR" });
            ftpService.dir.mockResolvedValue([{ name: "renamed", type: "DIR" }]);
            await ftpFacade.rename({
                dir: "/files",
                entry: { name: "photos", type: "DIR" },
                newName: "renamed",
                authUser
            });
            expect(memoryCache.has("user-id", "/files/photos")).toBe(false);
            expect(memoryCache.get("user-id", "/files/renamed")).toBe(bufferMap);
            expect(directoryCache.has("user-id", "/files/photos")).toBe(false);
            expect(directoryCache.get("user-id", "/files/renamed")).toEqual(directory);
        });

        it("should delete cached folder paths and return the current directory", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            const directory = { username: "ronin", hash: "hash" };
            memoryCache.set("user-id", "/files/photos", new Map());
            directoryCache.set("user-id", "/files/photos", directory);
            ftpService.delete.mockResolvedValue(["photos"]);
            const entries = [{ name: "photos", type: "DIR" }];
            await expect(ftpFacade.delete({ dir: "/files", entries, authUser })).resolves.toEqual({
                hash: expect.any(String),
                data: []
            });
            expect(memoryCache.has("user-id", "/files/photos")).toBe(false);
            expect(directoryCache.has("user-id", "/files/photos")).toBe(false);
        });

        it("should propagate write errors", async () => {
            const data = { authUser: { username: "ronin" } };
            ftpService.delete.mockRejectedValue(new Error("FTP error"));
            await expect(ftpFacade.delete(data)).rejects.toThrow("FTP error");
        });
    });
});
