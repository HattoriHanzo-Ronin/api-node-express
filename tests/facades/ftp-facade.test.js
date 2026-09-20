import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemoryCache from "../../src/cache/memory-cache.js";
import FtpFacade from "../../src/facades/ftp-facade.js";
import FtpMapper from "../../src/mappers/ftp-mapper.js";

describe("FtpFacade", () => {
    let ftpService;
    let dataVersionsService;
    let memoryCache;
    let tx;
    let ftpFacade;
    const clientTx = {};

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
        dataVersionsService = {
            getById: vi.fn().mockResolvedValue({ version: "5" }),
            increment: vi.fn()
        };
        tx = vi.fn(async (callback) => callback(clientTx));
        ftpService.getThumbails.mockResolvedValue(new Map());
        memoryCache = new MemoryCache();
        ftpFacade = new FtpFacade({
            ftpService,
            dataVersionsService,
            ftpMapper: FtpMapper,
            memoryCache,
            tx
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
                version: "5",
                data: [
                    { name: "folder", type: "DIR" },
                    { name: "photo.jpg", type: "FILE", hasThumbnail: true },
                    { name: "video.mp4", type: "FILE", hasThumbnail: false }
                ]
            });
            expect(ftpService.getThumbails).toHaveBeenCalledWith({ ...data, names: ["photo.jpg", "video.mp4"] });
            await expect(ftpFacade.getThumbnail({ dir: data.dir, name: "photo.jpg", authUser: data.authUser })).resolves.toEqual(Buffer.from("thumbnail"));
            expect(dataVersionsService.getById).toHaveBeenCalledWith({ id: "ftp" });
            expect(tx).not.toHaveBeenCalled();
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
                version: "5",
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
            await vi.advanceTimersByTimeAsync(299999);
            await ftpFacade.dir(data);
            expect(ftpService.getThumbails).toHaveBeenCalledOnce();
            await vi.advanceTimersByTimeAsync(299999);
            await expect(ftpFacade.getThumbnail({ dir: data.dir, name: "photo.jpg", authUser: data.authUser })).resolves.toEqual(Buffer.from("thumbnail"));
            await vi.advanceTimersByTimeAsync(300000);
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

        it("should download resources without incrementing their version", async () => {
            const data = { dir: "/files", entries: [], authUser: { username: "ronin" } };
            ftpService.download.mockResolvedValue("/tmp/file.txt");
            await expect(ftpFacade.download(data)).resolves.toBe("/tmp/file.txt");
            expect(ftpService.download).toHaveBeenCalledWith(data);
            expect(tx).not.toHaveBeenCalled();
            expect(dataVersionsService.increment).not.toHaveBeenCalled();
        });
    });

    describe("write operations", () => {
        it.each([
            ["makeDir", { name: "docs", type: "DIR" }, { name: "docs", type: "DIR" }],
            ["move", { lastContent: [], movedContent: [] }, { lastContent: [], movedContent: [] }],
            ["rename", { name: "file.txt", type: "FILE" }, { name: "file.txt", type: "FILE", hasThumbnail: false }],
            ["upload", [{ name: "file.txt", type: "FILE" }], [{ name: "file.txt", type: "FILE", hasThumbnail: false }]],
            ["delete", ["file.txt"], ["file.txt"]]
        ])("should execute %s and increment the FTP version in a transaction", async (method, result, expected) => {
            const data = {
                dir: "/files",
                destination: "/destination",
                entry: { name: "file.txt", type: "FILE" },
                entries: [],
                authUser: { id: "user-id", username: "ronin" }
            };
            ftpService[method].mockResolvedValue(result);
            await expect(ftpFacade[method](data)).resolves.toEqual(expected);
            expect(ftpService[method]).toHaveBeenCalledWith(data);
            expect(tx).toHaveBeenCalledOnce();
            expect(dataVersionsService.increment).toHaveBeenCalledWith({
                clientTx,
                id: "ftp"
            });
        });

        it("should rename a cached thumbnail key", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            const thumbnail = Buffer.from("thumbnail");
            ftpService.dir.mockResolvedValue([{ name: "photo.jpg", type: "FILE" }]);
            ftpService.getThumbails.mockResolvedValue(new Map([["photo.jpg", thumbnail]]));
            await ftpFacade.dir({ dir: "/files", authUser });
            ftpService.rename.mockResolvedValue({ name: "renamed.jpg", type: "FILE" });
            await expect(
                ftpFacade.rename({
                    dir: "/files",
                    entry: { name: "photo.jpg", type: "FILE" },
                    newName: "renamed.jpg",
                    authUser
                })
            ).resolves.toEqual({ name: "renamed.jpg", type: "FILE", hasThumbnail: true });
            const bufferMap = memoryCache.get("user-id", "/files");
            expect(bufferMap.has("photo.jpg")).toBe(false);
            expect(bufferMap.get("renamed.jpg")).toBe(thumbnail);
        });

        it("should move cached thumbnails and enrich moved entries", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            const thumbnail = Buffer.from("thumbnail");
            ftpService.dir.mockResolvedValueOnce([{ name: "photo.jpg", type: "FILE" }]);
            ftpService.getThumbails.mockResolvedValueOnce(new Map([["photo.jpg", thumbnail]]));
            await ftpFacade.dir({ dir: "/source", authUser });
            ftpService.dir.mockResolvedValueOnce([{ name: "existing.jpg", type: "FILE" }]);
            ftpService.getThumbails.mockResolvedValueOnce(new Map([["existing.jpg", Buffer.from("existing")]]));
            await ftpFacade.dir({ dir: "/destination", authUser });
            const entries = [{ name: "photo.jpg", type: "FILE" }];
            ftpService.move.mockResolvedValue({
                lastContent: ["photo.jpg"],
                movedContent: [{ name: "moved.jpg", type: "FILE" }]
            });
            await expect(ftpFacade.move({ dir: "/source", destination: "/destination", entries, authUser })).resolves.toEqual({
                lastContent: ["photo.jpg"],
                movedContent: [{ name: "moved.jpg", type: "FILE", hasThumbnail: true }]
            });
            expect(memoryCache.get("user-id", "/source").has("photo.jpg")).toBe(false);
            expect(memoryCache.get("user-id", "/destination").get("moved.jpg")).toBe(thumbnail);
        });

        it("should generate uploaded thumbnails and enrich uploaded entries", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            const thumbnail = Buffer.from("thumbnail");
            ftpService.dir.mockResolvedValue([{ name: "existing.jpg", type: "FILE" }]);
            ftpService.getThumbails.mockResolvedValueOnce(new Map([["existing.jpg", Buffer.from("existing")]]));
            await ftpFacade.dir({ dir: "/files", authUser });
            ftpService.upload.mockResolvedValue([{ name: "uploaded.jpg", type: "FILE" }]);
            ftpService.getThumbails.mockResolvedValueOnce(new Map([["uploaded.jpg", thumbnail]]));
            await expect(ftpFacade.upload({ dir: "/files", file: {}, authUser })).resolves.toEqual([
                { name: "uploaded.jpg", type: "FILE", hasThumbnail: true }
            ]);
            expect(ftpService.getThumbails).toHaveBeenLastCalledWith({
                dir: "/files",
                names: ["uploaded.jpg"],
                authUser
            });
            expect(memoryCache.get("user-id", "/files").get("uploaded.jpg")).toBe(thumbnail);
        });

        it("should remove deleted file thumbnails and cached directories", async () => {
            const authUser = { id: "user-id", username: "ronin" };
            ftpService.dir.mockResolvedValueOnce([
                { name: "photo.jpg", type: "FILE" },
                { name: "photos", type: "DIR" }
            ]);
            ftpService.getThumbails.mockResolvedValueOnce(new Map([["photo.jpg", Buffer.from("thumbnail")]]));
            await ftpFacade.dir({ dir: "/files", authUser });
            ftpService.dir.mockResolvedValueOnce([{ name: "nested.jpg", type: "FILE" }]);
            ftpService.getThumbails.mockResolvedValueOnce(new Map([["nested.jpg", Buffer.from("nested")]]));
            await ftpFacade.dir({ dir: "/files/photos", authUser });
            const entries = [
                { name: "photo.jpg", type: "FILE" },
                { name: "photos", type: "DIR" }
            ];
            ftpService.delete.mockResolvedValue(["photo.jpg", "photos"]);
            await expect(ftpFacade.delete({ dir: "/files", entries, authUser })).resolves.toEqual([
                "photo.jpg",
                "photos"
            ]);
            expect(memoryCache.get("user-id", "/files").has("photo.jpg")).toBe(false);
            expect(memoryCache.get("user-id", "/files/photos")).toBeUndefined();
        });

        it("should not increment the FTP version when the operation fails", async () => {
            const data = { authUser: { username: "ronin" } };
            ftpService.delete.mockRejectedValue(new Error("FTP error"));
            await expect(ftpFacade.delete(data)).rejects.toThrow("FTP error");
            expect(dataVersionsService.increment).not.toHaveBeenCalled();
        });
    });
});
