import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE } from "../../src/config/constants.js";
import MemoryCache from "../../src/cache/memory-cache.js";
import DirectoryCache from "../../src/cache/directory-cache.js";
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
            getThumbails: vi.fn(),
            makeDir: vi.fn(),
            move: vi.fn(),
            rename: vi.fn(),
            upload: vi.fn(),
            download: vi.fn(),
            delete: vi.fn()
        };
        ftpService.dir.mockResolvedValue([]);
        ftpService.getThumbails.mockResolvedValue(new Map());
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
        it("should cache thumbnails from normalized file entries while returning directory content", async () => {
            const data = { dir: "/files", authUser: { id: "user-id", username: "ronin" } };
            const entries = [
                { name: "folder", type: "DIR" },
                { name: "photo.jpg", type: "FILE" },
                { name: "video.mp4", type: "FILE" }
            ];
            const thumbnails = new Map([["photo.jpg", Buffer.from("thumbnail")]]);
            ftpService.dir.mockResolvedValue(entries);
            ftpService.getThumbails.mockResolvedValue(thumbnails);
            await expect(ftpFacade.dir(data)).resolves.toEqual({
                hash: expect.any(String),
                data: [
                    { name: "folder", type: "DIR" },
                    { name: "photo.jpg", type: "FILE", hasThumbnail: true },
                    { name: "video.mp4", type: "FILE", hasThumbnail: false }
                ]
            });
            expect(ftpService.getThumbails).toHaveBeenCalledWith({ ...data, names: ["photo.jpg", "video.mp4"] });
            await expect(ftpFacade.getThumbnail({ dir: data.dir, name: "photo.jpg", authUser: data.authUser })).resolves.toEqual(Buffer.from("thumbnail"));
        });

        it("should update the directory hash every five seconds without exposing its metadata", async () => {
            const data = { dir: "/files", authUser: { id: "user-id", username: "ronin" } };
            ftpService.dir
                .mockResolvedValueOnce([
                    { name: "photo.jpg", type: "FILE", size: 100, modifyTime: "2026-09-20T10:00:00.000Z" }
                ])
                .mockResolvedValueOnce([
                    { name: "photo.jpg", type: "FILE", size: 200, modifyTime: "2026-09-20T10:01:00.000Z" }
                ]);
            await expect(ftpFacade.dir(data)).resolves.toEqual({
                hash: expect.any(String),
                data: [{ name: "photo.jpg", type: "FILE", hasThumbnail: false }]
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
                { name: "old.jpg", type: "FILE" },
                { name: "removed.jpg", type: "FILE" },
                { name: "notes.txt", type: "FILE" }
            ]);
            ftpService.getThumbails.mockResolvedValueOnce(new Map([
                ["old.jpg", Buffer.from("old")],
                ["removed.jpg", Buffer.from("removed")],
                ["notes.txt", null]
            ]));
            await ftpFacade.dir(data);
            ftpService.dir.mockResolvedValueOnce([
                { name: "old.jpg", type: "FILE" },
                { name: "new.jpg", type: "FILE" },
                { name: "notes.txt", type: "FILE" }
            ]);
            ftpService.getThumbails.mockResolvedValueOnce(new Map([["new.jpg", Buffer.from("new")]]));
            await expect(ftpFacade.dir(data)).resolves.toEqual({
                hash: expect.any(String),
                data: [
                    { name: "old.jpg", type: "FILE", hasThumbnail: true },
                    { name: "new.jpg", type: "FILE", hasThumbnail: true },
                    { name: "notes.txt", type: "FILE", hasThumbnail: false }
                ]
            });
            expect(ftpService.getThumbails).toHaveBeenLastCalledWith({ ...data, names: ["new.jpg"] });
            expect(memoryCache.get("user-id", "/files").has("removed.jpg")).toBe(false);
        });

        it("should reuse the same directory cache and regenerate it after expiration", async () => {
            const data = { dir: "/files", authUser: { id: "user-id", username: "ronin" } };
            ftpService.dir.mockResolvedValue([{ name: "photo.jpg", type: "FILE" }]);
            ftpService.getThumbails.mockResolvedValue(new Map([["photo.jpg", Buffer.from("thumbnail")]]));
            await ftpFacade.dir(data);
            await vi.advanceTimersByTimeAsync(CACHE.inactivityTimeout - 1);
            await ftpFacade.dir(data);
            expect(ftpService.getThumbails).toHaveBeenCalledOnce();
            await vi.advanceTimersByTimeAsync(CACHE.inactivityTimeout - 1);
            await expect(ftpFacade.getThumbnail({ dir: data.dir, name: "photo.jpg", authUser: data.authUser })).resolves.toEqual(Buffer.from("thumbnail"));
            await vi.advanceTimersByTimeAsync(CACHE.inactivityTimeout);
            await expect(ftpFacade.getThumbnail({ dir: data.dir, name: "photo.jpg", authUser: data.authUser })).resolves.toEqual(Buffer.from("thumbnail"));
            expect(ftpService.getThumbails).toHaveBeenCalledTimes(2);
        });

        it("should return thumbnails from the requested cached directory", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            ftpService.dir.mockResolvedValueOnce([{ name: "first.jpg", type: "FILE" }]);
            ftpService.getThumbails.mockResolvedValueOnce(new Map([["first.jpg", Buffer.from("first")]]));
            await ftpFacade.dir({ dir: "/first", authUser });
            ftpService.dir.mockResolvedValueOnce([{ name: "second.jpg", type: "FILE" }]);
            ftpService.getThumbails.mockResolvedValueOnce(new Map([["second.jpg", Buffer.from("second")]]));
            await ftpFacade.dir({ dir: "/second", authUser });
            await expect(ftpFacade.getThumbnail({ dir: "/first", name: "first.jpg", authUser })).resolves.toEqual(Buffer.from("first"));
            await expect(ftpFacade.getThumbnail({ dir: "/second", name: "second.jpg", authUser })).resolves.toEqual(Buffer.from("second"));
        });

        it("should fail when the thumbnail does not exist", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            ftpService.dir.mockResolvedValue([{ name: "photo.jpg", type: "FILE" }]);
            ftpService.getThumbails.mockResolvedValue(new Map([["photo.jpg", null]]));
            await ftpFacade.dir({ dir: "/files", authUser });
            await expect(ftpFacade.getThumbnail({ dir: "/files", name: "photo.jpg", authUser })).rejects.toMatchObject({
                status: 404,
                code: "FTP_THUMBNAIL_NOT_FOUND",
                message: "La miniatura no existe"
            });
        });

        it("should download resources", async () => {
            const data = { dir: "/files", entries: [], authUser: { username: "ronin" } };
            ftpService.download.mockResolvedValue("/tmp/file.txt");
            await expect(ftpFacade.download(data)).resolves.toBe("/tmp/file.txt");
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
