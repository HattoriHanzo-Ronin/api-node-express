import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PassThrough, Readable, Writable } from "node:stream";

const authUser = { id: "user-id", username: "ronin" };
const { mockClient, mockCloseClient, mockCompressionUtils } = vi.hoisted(() => ({
    mockClient: {
        list: vi.fn(),
        exists: vi.fn(),
        get: vi.fn(),
        stat: vi.fn(),
        createReadStream: vi.fn(),
        createWriteStream: vi.fn(),
        mkdir: vi.fn(),
        rename: vi.fn(),
        put: vi.fn(),
        fastPut: vi.fn(),
        fastGet: vi.fn(),
        delete: vi.fn(),
        rmdir: vi.fn()
    },
    mockCloseClient: vi.fn(),
    mockCompressionUtils: { executeUpload: vi.fn(), executeDownload: vi.fn() }
}));

vi.mock("../../src/utils/connection/ftp-client.js", () => ({
    default: { getClient: vi.fn(async () => mockClient), closeClient: mockCloseClient }
}));

vi.mock("../../src/utils/compression-utils.js", () => ({ default: mockCompressionUtils }));

vi.mock("../../src/config/environment.js", () => ({
    ENV: {
        apiUrl: "http://api-node-express:60004",
        thumbnailGeneratorUrl: "http://thumbnail-generator:3000",
        ftpMaxConnections: 100,
        ftpMaxTransfers: 16,
        ftpIdleTimeout: 15 * 60 * 1000,
        ftpScaleWait: 5000,
        ftpProtectedUsers: ""
    }
}));

import FtpClient from "../../src/utils/connection/ftp-client.js";
import FtpService from "../../src/services/ftp-service.js";

describe("FtpService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.list.mockResolvedValue([]);
        mockClient.exists.mockResolvedValue("d");
        mockClient.createWriteStream.mockImplementation(() => new Writable({ write(chunk, encoding, callback) { callback(); } }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe("dir", () => {
        it("should list ftp resources", async () => {
            const modifyTime = new Date("2026-09-20T10:00:00.000Z");
            mockClient.list.mockResolvedValue([
                { name: "docs", type: "d", size: 0, modifyTime },
                { name: "file.txt", type: "-", size: 128, modifyTime },
                { name: "photo.jpg", type: "-", size: 256, modifyTime }
            ]);
            await expect(FtpService.dir({ dir: "files", authUser })).resolves.toEqual([
                { name: "docs", type: "DIR", size: 0, modifyTime, supportsThumbnail: false },
                { name: "file.txt", type: "FILE", size: 128, modifyTime, supportsThumbnail: false },
                { name: "photo.jpg", type: "FILE", size: 256, modifyTime, supportsThumbnail: true }
            ]);
            expect(FtpClient.getClient).toHaveBeenCalledWith(authUser.username);
            expect(mockClient.list).toHaveBeenCalledWith("files");
        });

        it("should use the directory normalized by the schema", async () => {
            await FtpService.dir({ dir: ".", authUser });
            expect(mockClient.list).toHaveBeenCalledWith(".");
        });

        it("should translate list errors", async () => {
            mockClient.list.mockRejectedValue(new Error("ftp down"));
            await expect(FtpService.dir({ dir: "files", authUser })).rejects.toThrow("Error al listar la carpeta");
        });
    });

    describe("getThumbnails", () => {
        const media = Buffer.from("0123456789".repeat(10));

        beforeEach(() => {
            vi.clearAllMocks();
            mockClient.stat.mockResolvedValue({ size: media.length });
            mockClient.createReadStream.mockImplementation((remote, { start, end }) =>
                Readable.from(media.subarray(start, end + 1))
            );
        });

        it("delegates thumbnail generation to the isolated service", async () => {
            const thumbnail = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
            vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(thumbnail))));
            const thumbnails = new Map();
            await FtpService.getThumbnails({
                dir: "media",
                names: ["photo.PNG", "video.mp4"],
                authUser,
                callback: async ({ name, thumbnail: result }) => thumbnails.set(name, result)
            });
            expect(thumbnails).toEqual(new Map([
                ["photo.PNG", thumbnail],
                ["video.mp4", thumbnail]
            ]));
            expect(fetch).toHaveBeenCalledTimes(2);
            for (const [url, options] of fetch.mock.calls) {
                expect(url).toMatch(/^http:\/\/thumbnail-generator:3000\/thumbnail\/[\da-f-]{36}$/);
                expect(options).toEqual({
                    method: "POST",
                    headers: { Origin: "http://api-node-express:60004" },
                    signal: expect.any(AbortSignal)
                });
            }
            const id = fetch.mock.calls[0][0].split("/").at(-1);
            const expiredStream = new PassThrough();
            await FtpService.streamMedia({ id, method: "GET", stream: expiredStream });
            expect(expiredStream.statusCode).toBe(204);
            expect(expiredStream.writableEnded).toBe(true);
        });

        it("streams registered media ranges while thumbnail generation is active", async () => {
            const thumbnail = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
            vi.stubGlobal("fetch", vi.fn(async (url) => {
                const id = url.split("/").at(-1);
                const output = new PassThrough();
                const chunks = [];
                output.writeHead = vi.fn();
                output.on("data", (chunk) => chunks.push(chunk));
                await FtpService.streamMedia({ id, range: "bytes=0-9", method: "GET", stream: output });
                expect(Buffer.concat(chunks)).toEqual(media.subarray(0, 10));
                expect(output.writeHead).toHaveBeenCalledWith(206, {
                    "Accept-Ranges": "bytes",
                    "Content-Length": 10,
                    "Content-Range": expect.stringMatching(/^bytes 0-9\/\d+$/)
                });
                return new Response(thumbnail);
            }));
            const callback = vi.fn();
            await FtpService.getThumbnails({ dir: "media", names: ["photo.PNG"], authUser, callback });
            expect(callback).toHaveBeenCalledWith({ name: "photo.PNG", thumbnail });
            expect(mockClient.createReadStream).toHaveBeenCalledWith("media/photo.PNG", { start: 0, end: 9 });
        });

        it("returns null when the generator response exceeds the allowed size", async () => {
            vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(Buffer.alloc(5 * 1024 * 1024 + 1)))));
            const callback = vi.fn();
            await FtpService.getThumbnails({ dir: "media", names: ["oversized.mp4"], authUser, callback });
            expect(callback).toHaveBeenCalledWith({ name: "oversized.mp4", thumbnail: null });
        });

        it("returns null when a thumbnail cannot be generated", async () => {
            mockClient.stat.mockRejectedValue(new Error("missing"));
            const callback = vi.fn();
            await FtpService.getThumbnails({ dir: "media", names: ["missing.mp4"], authUser, callback });
            expect(mockClient.stat).toHaveBeenCalledWith("media/missing.mp4");
            expect(callback).toHaveBeenCalledWith({ name: "missing.mp4", thumbnail: null });
        });

    });

    describe("makeDir", () => {
        it("should create a directory", async () => {
            await expect(FtpService.makeDir({ dir: "files", name: "images", authUser })).resolves.toBeUndefined();
            expect(mockClient.list).toHaveBeenCalledWith("files");
            expect(mockClient.mkdir).toHaveBeenCalledWith("files/images");
        });

        it("should generate a copy name when directory already exists", async () => {
            mockClient.list.mockResolvedValue([{ name: "images" }]);
            await expect(FtpService.makeDir({ dir: "files", name: "images", authUser })).resolves.toBeUndefined();
            expect(mockClient.mkdir).toHaveBeenCalledWith("files/images (1)");
        });

        it("should generate incremental copy names", async () => {
            mockClient.list.mockResolvedValue([
                { name: "images" },
                { name: "images (1)" },
                { name: "images (2)" }
            ]);
            await FtpService.makeDir({ dir: "files", name: "images", authUser });
            expect(mockClient.mkdir).toHaveBeenCalledWith("files/images (3)");
        });
    });

    describe("move", () => {
        it("should move entries and avoid destination name collisions", async () => {
            mockClient.list.mockResolvedValue([{ name: "file.txt" }]);
            const entries = [{ name: "file.txt", type: "FILE" }];
            const onEntry = vi.fn();
            await expect(
                FtpService.move({ dir: "files", destination: "backup", entries, authUser, onEntry })
            ).resolves.toBeUndefined();
            expect(mockClient.list).toHaveBeenCalledWith("backup");
            expect(mockClient.rename).toHaveBeenCalledWith("files/file.txt", "backup/file (1).txt");
            expect(onEntry).toHaveBeenCalledWith(entries[0], "file (1).txt");
        });

        it("should move multiple entries using incremental collision names", async () => {
            mockClient.list.mockResolvedValue([{ name: "image.png" }]);
            const entries = [
                { name: "image.png", type: "FILE" },
                { name: "image.png", type: "FILE" }
            ];
            const onEntry = vi.fn();
            await expect(
                FtpService.move({ dir: "files", destination: "backup", entries, authUser, onEntry })
            ).resolves.toBeUndefined();
            expect(onEntry).toHaveBeenNthCalledWith(1, entries[0], "image (1).png");
            expect(onEntry).toHaveBeenNthCalledWith(2, entries[1], "image (2).png");
        });
    });

    describe("rename", () => {
        it("should rename an entry", async () => {
            const entry = { name: "file.txt", type: "FILE" };
            await expect(
                FtpService.rename({ dir: "files", entry, newName: "renamed.txt", authUser })
            ).resolves.toEqual({ name: "renamed.txt", type: "FILE" });
            expect(mockClient.list).toHaveBeenCalledWith("files");
            expect(mockClient.rename).toHaveBeenCalledWith("files/file.txt", "files/renamed.txt");
        });

        it("should generate a copy name when new name already exists", async () => {
            mockClient.list.mockResolvedValue([{ name: "renamed.txt" }]);
            await FtpService.rename({
                dir: "files",
                entry: { name: "file.txt", type: "FILE" },
                newName: "renamed.txt",
                authUser
            });
            expect(mockClient.rename).toHaveBeenCalledWith("files/file.txt", "files/renamed (1).txt");
        });
    });

    describe("upload", () => {
        it("should create directories and upload each file independently", async () => {
            mockClient.list.mockResolvedValue([{ name: "images" }, { name: "images (1)" }]);
            const entries = [
                { path: "images", type: "DIR" },
                { path: "images/photo.jpg", type: "FILE" }
            ];
            const session = await FtpService.createUpload({ dir: "upload/new", entries, authUser });
            expect(session.entries).toEqual([
                { path: "images (2)", type: "DIR" },
                { path: "images (2)/photo.jpg", type: "FILE" }
            ]);
            expect(mockClient.mkdir).toHaveBeenCalledWith("upload/new", true);
            expect(mockClient.mkdir).toHaveBeenCalledWith("upload/new/images (2)", true);

            const file = { originalname: "photo.jpg", stream: Readable.from("photo") };
            await expect(FtpService.upload({
                id: session.id,
                entryPath: "images (2)/photo.jpg",
                file,
                authUser
            })).resolves.toEqual({ nextOffset: 5 });
            expect(mockClient.createWriteStream).toHaveBeenCalledWith("upload/new/images (2)/photo.jpg", {
                flags: "w",
                start: 0
            });
            await expect(FtpService.completeUpload({ id: session.id, authUser })).resolves.toEqual({
                dir: "upload/new"
            });
            expect(mockClient.rename).not.toHaveBeenCalled();
        });

        it("should reject completion while files are pending", async () => {
            const session = await FtpService.createUpload({
                dir: "upload",
                entries: [{ path: "file.txt", type: "FILE" }],
                authUser
            });
            await expect(FtpService.completeUpload({ id: session.id, authUser })).rejects.toThrow(
                "La subida contiene archivos pendientes"
            );
            await FtpService.cancelTransfer({ id: session.id, authUser });
        });

        it("should resolve collisions created while the upload is in progress", async () => {
            const session = await FtpService.createUpload({
                dir: "upload",
                entries: [{ path: "file.txt", type: "FILE" }],
                authUser
            });
            const file = { originalname: "file.txt", stream: Readable.from("content") };
            mockClient.list.mockResolvedValueOnce([{ name: "file.txt" }]);
            await FtpService.upload({ id: session.id, entryPath: "file.txt", file, authUser });
            await FtpService.completeUpload({ id: session.id, authUser });
            expect(mockClient.createWriteStream).toHaveBeenCalledWith("upload/file (1).txt", {
                flags: "w",
                start: 0
            });
            expect(mockClient.rename).not.toHaveBeenCalled();
        });

        it("should upload a large file through sequential offsets", async () => {
            const session = await FtpService.createUpload({
                dir: "upload",
                entries: [{ path: "large.bin", type: "FILE", size: 11 }],
                authUser
            });
            await expect(FtpService.upload({
                id: session.id,
                entryPath: "large.bin",
                offset: 0,
                file: { originalname: "large.bin", stream: Readable.from("hello") },
                authUser
            })).resolves.toEqual({ nextOffset: 5 });
            await expect(FtpService.completeUpload({ id: session.id, authUser })).rejects.toThrow(
                "La subida contiene archivos pendientes"
            );
            await expect(FtpService.upload({
                id: session.id,
                entryPath: "large.bin",
                offset: 5,
                file: { originalname: "large.bin", stream: Readable.from(" world") },
                authUser
            })).resolves.toEqual({ nextOffset: 11 });
            const [remotePath] = mockClient.createWriteStream.mock.calls[0];
            expect(mockClient.createWriteStream).toHaveBeenNthCalledWith(2, remotePath, {
                flags: "r+",
                start: 5
            });
            await expect(FtpService.completeUpload({ id: session.id, authUser })).resolves.toEqual({ dir: "upload" });
        });

        it("should reject an unexpected upload offset without corrupting the session", async () => {
            const session = await FtpService.createUpload({
                dir: "upload",
                entries: [{ path: "large.bin", type: "FILE", size: 10 }],
                authUser
            });
            const file = { originalname: "large.bin", stream: Readable.from("chunk") };
            await expect(FtpService.upload({
                id: session.id,
                entryPath: "large.bin",
                offset: 5,
                file,
                authUser
            })).rejects.toThrow("Offset no válido, se esperaba 0");
            expect(mockClient.createWriteStream).not.toHaveBeenCalled();
            await FtpService.cancelTransfer({ id: session.id, authUser });
        });

        it("should identify session owners by user id", async () => {
            const session = await FtpService.createUpload({
                dir: "upload",
                entries: [{ path: "file.txt", type: "FILE" }],
                authUser
            });
            const otherUser = { id: "other-user-id", username: authUser.username };
            await expect(FtpService.upload({
                id: session.id,
                entryPath: "file.txt",
                file: { originalname: "file.txt", stream: Readable.from("content") },
                authUser: otherUser
            })).rejects.toThrow("Sesión de transferencia no válida");
            await FtpService.cancelTransfer({ id: session.id, authUser });
        });

        it("should roll back every resource created by a cancelled upload", async () => {
            mockClient.exists.mockImplementation(async (remotePath) => remotePath === "upload" ? "d" : false);
            const session = await FtpService.createUpload({
                dir: "upload/new",
                entries: [
                    { path: "images", type: "DIR" },
                    { path: "images/photo.jpg", type: "FILE" },
                    { path: "document.txt", type: "FILE" }
                ],
                authUser
            });
            const photo = { originalname: "photo.jpg", stream: Readable.from("photo") };
            const document = { originalname: "document.txt", stream: Readable.from("document") };
            mockClient.list.mockResolvedValue([]);
            await FtpService.upload({ id: session.id, entryPath: "images/photo.jpg", file: photo, authUser });
            await FtpService.upload({ id: session.id, entryPath: "document.txt", file: document, authUser });
            await FtpService.cancelTransfer({ id: session.id, authUser });
            expect(mockClient.delete).toHaveBeenCalledWith("upload/new/images/photo.jpg");
            expect(mockClient.delete).toHaveBeenCalledWith("upload/new/document.txt");
            expect(mockClient.rmdir).toHaveBeenCalledWith("upload/new/images", false);
            expect(mockClient.rmdir).toHaveBeenCalledWith("upload/new", false);
            expect(mockClient.rmdir).not.toHaveBeenCalledWith("upload", false);
        });

        it("should roll back the whole upload when a file fails", async () => {
            const session = await FtpService.createUpload({
                dir: "upload",
                entries: [
                    { path: "first.txt", type: "FILE" },
                    { path: "second.txt", type: "FILE" }
                ],
                authUser
            });
            const first = { originalname: "first.txt", stream: Readable.from("first") };
            mockClient.list.mockResolvedValue([]);
            await FtpService.upload({ id: session.id, entryPath: "first.txt", file: first, authUser });
            mockClient.createWriteStream.mockImplementationOnce(() => new Writable({
                write(chunk, encoding, callback) { callback(new Error("connection lost")); }
            }));
            const second = { originalname: "second.txt", stream: Readable.from("second") };
            await expect(FtpService.upload({
                id: session.id,
                entryPath: "second.txt",
                file: second,
                authUser
            })).rejects.toThrow("Error al subir los datos");
            expect(mockClient.delete).toHaveBeenCalledWith("upload/first.txt");
            expect(mockClient.delete).toHaveBeenCalledWith("upload/second.txt");
            await expect(FtpService.upload({
                id: session.id,
                entryPath: "second.txt",
                file: second,
                authUser
            })).rejects.toThrow("Sesión de transferencia no válida");
        });
    });

    describe("delete", () => {
        it("should delete files", async () => {
            const entries = [{ name: "test.txt", type: "FILE" }];
            const onEntry = vi.fn();
            await expect(FtpService.delete({ dir: "files", entries, authUser, onEntry })).resolves.toBeUndefined();
            expect(mockClient.delete).toHaveBeenCalledWith("files/test.txt");
            expect(onEntry).toHaveBeenCalledWith(entries[0]);
        });

        it("should delete directories", async () => {
            const entries = [{ name: "images", type: "DIR" }];
            const onEntry = vi.fn();
            await expect(FtpService.delete({ dir: "files", entries, authUser, onEntry })).resolves.toBeUndefined();
            expect(mockClient.rmdir).toHaveBeenCalledWith("files/images", true);
            expect(onEntry).toHaveBeenCalledWith(entries[0]);
        });
    });

    describe("download", () => {
        it("should create a sized manifest and download from an offset", async () => {
            mockClient.list.mockImplementation(async (remotePath) =>
                remotePath === "files/docs" ? [{ name: "nested.txt", type: "-" }] : []
            );
            mockClient.stat.mockImplementation(async (remotePath) => ({
                size: remotePath === "files/file1.txt" ? 5 : 6
            }));
            mockClient.createReadStream.mockImplementation((remotePath, { start }) =>
                Readable.from(Buffer.from("nested").subarray(start))
            );
            const session = await FtpService.createDownload({
                dir: "files",
                entries: [
                    { name: "file1.txt", type: "FILE" },
                    { name: "docs", type: "DIR" }
                ],
                authUser
            });
            expect(session).toEqual({
                id: expect.any(String),
                totalBytes: 11,
                entries: [
                    { path: "file1.txt", type: "FILE", size: 5 },
                    { path: "docs", type: "DIR" },
                    { path: "docs/nested.txt", type: "FILE", size: 6 }
                ]
            });
            const stream = new PassThrough();
            stream.setHeader = vi.fn();
            const chunks = [];
            stream.on("data", (chunk) => chunks.push(chunk));
            await FtpService.download({ id: session.id, entryPath: "docs/nested.txt", offset: 2, authUser, stream });
            expect(mockClient.createReadStream).toHaveBeenCalledWith("files/docs/nested.txt", { start: 2 });
            expect(stream.setHeader).toHaveBeenCalledWith("Content-Length", 4);
            expect(Buffer.concat(chunks).toString()).toBe("sted");
            await FtpService.cancelTransfer({ id: session.id, authUser });
        });

        it("should include empty files without adding directory sizes", async () => {
            mockClient.list.mockResolvedValue([{ name: "empty.txt", type: "-" }]);
            mockClient.stat.mockResolvedValue({ size: 0 });
            const session = await FtpService.createDownload({
                dir: "files",
                entries: [{ name: "docs", type: "DIR" }],
                authUser
            });
            expect(session).toEqual({
                id: expect.any(String),
                totalBytes: 0,
                entries: [
                    { path: "docs", type: "DIR" },
                    { path: "docs/empty.txt", type: "FILE", size: 0 }
                ]
            });
            const stream = new PassThrough();
            stream.setHeader = vi.fn();
            await FtpService.download({ id: session.id, entryPath: "docs/empty.txt", authUser, stream });
            expect(stream.setHeader).toHaveBeenCalledWith("Content-Length", 0);
            expect(stream.writableEnded).toBe(true);
            await FtpService.cancelTransfer({ id: session.id, authUser });
        });

        it("should reject a stale download manifest", async () => {
            mockClient.stat.mockResolvedValueOnce({ size: 4 }).mockResolvedValueOnce({ size: 5 });
            const session = await FtpService.createDownload({
                dir: "files",
                entries: [{ name: "file.txt", type: "FILE" }],
                authUser
            });
            await expect(FtpService.download({
                id: session.id,
                entryPath: "file.txt",
                authUser,
                stream: new PassThrough()
            })).rejects.toMatchObject({ code: "FTP_DOWNLOAD_STALE", status: 409 });
        });

        it("should reject a download when a manifest file was deleted", async () => {
            mockClient.stat.mockResolvedValueOnce({ size: 4 }).mockRejectedValueOnce(new Error("not found"));
            const session = await FtpService.createDownload({
                dir: "files",
                entries: [{ name: "file.txt", type: "FILE" }],
                authUser
            });
            await expect(FtpService.download({
                id: session.id,
                entryPath: "file.txt",
                authUser,
                stream: new PassThrough()
            })).rejects.toMatchObject({ code: "FTP_DOWNLOAD_STALE", status: 409 });
        });

        it("should invalidate the whole session when a download fails", async () => {
            mockClient.stat.mockResolvedValue({ size: 4 });
            mockClient.createReadStream.mockReturnValue(Readable.from((async function* () {
                throw new Error("connection lost");
            })()));
            const session = await FtpService.createDownload({
                dir: "files",
                entries: [{ name: "file.txt", type: "FILE" }],
                authUser
            });
            await expect(FtpService.download({
                id: session.id,
                entryPath: "file.txt",
                authUser,
                stream: new PassThrough()
            })).rejects.toMatchObject({ code: "FTP_DOWNLOAD_FAILED" });
            await expect(FtpService.download({
                id: session.id,
                entryPath: "file.txt",
                authUser,
                stream: new PassThrough()
            })).rejects.toThrow("Sesión de transferencia no válida");
        });

        it("should stop an active download when its session is cancelled", async () => {
            mockClient.stat.mockResolvedValue({ size: 4 });
            const source = new PassThrough();
            mockClient.createReadStream.mockReturnValue(source);
            const session = await FtpService.createDownload({
                dir: "files",
                entries: [{ name: "file.txt", type: "FILE" }],
                authUser
            });
            const download = FtpService.download({
                id: session.id,
                entryPath: "file.txt",
                authUser,
                stream: new PassThrough()
            });
            const settled = download.then(() => null, (error) => error);
            await vi.waitFor(() => expect(mockClient.createReadStream).toHaveBeenCalledOnce());
            await FtpService.cancelTransfer({ id: session.id, authUser });
            expect(source.destroyed).toBe(true);
            await expect(settled).resolves.toMatchObject({ message: "Error al descargar" });
        });

        it("should reject unsafe download totals", async () => {
            mockClient.stat.mockResolvedValue({ size: Number.MAX_SAFE_INTEGER });
            await expect(FtpService.createDownload({
                dir: "files",
                entries: [
                    { name: "first.bin", type: "FILE" },
                    { name: "second.bin", type: "FILE" }
                ],
                authUser
            })).rejects.toThrow("Error al preparar la descarga");
        });
    });
});
