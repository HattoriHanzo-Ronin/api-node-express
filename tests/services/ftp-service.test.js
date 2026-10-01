import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PassThrough, Readable } from "node:stream";

const authUser = { username: "ronin" };
const { mockClient, mockCloseClient, mockCompressionUtils } = vi.hoisted(() => ({
    mockClient: {
        list: vi.fn(),
        get: vi.fn(),
        stat: vi.fn(),
        createReadStream: vi.fn(),
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
    ENV: { apiUrl: "http://api-node-express:60004", thumbnailGeneratorUrl: "http://thumbnail-generator:3000" }
}));

import FtpClient from "../../src/utils/connection/ftp-client.js";
import FtpService from "../../src/services/ftp-service.js";

describe("FtpService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.list.mockResolvedValue([]);
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
            await expect(FtpService.dir({ dir: "/files", authUser })).resolves.toEqual([
                { name: "docs", type: "DIR", size: 0, modifyTime, supportsThumbnail: false },
                { name: "file.txt", type: "FILE", size: 128, modifyTime, supportsThumbnail: false },
                { name: "photo.jpg", type: "FILE", size: 256, modifyTime, supportsThumbnail: true }
            ]);
            expect(FtpClient.getClient).toHaveBeenCalledWith(authUser.username);
            expect(mockClient.list).toHaveBeenCalledWith("/files");
            expect(mockCloseClient).toHaveBeenCalledWith(mockClient);
        });

        it("should use the directory normalized by the schema", async () => {
            await FtpService.dir({ dir: ".", authUser });
            expect(mockClient.list).toHaveBeenCalledWith(".");
        });

        it("should translate list errors", async () => {
            mockClient.list.mockRejectedValue(new Error("ftp down"));
            await expect(FtpService.dir({ dir: "/files", authUser })).rejects.toThrow("Error al listar la carpeta");
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
                dir: "/media",
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
            expect(FtpClient.getClient).toHaveBeenCalledOnce();
            expect(mockCloseClient).toHaveBeenCalledWith(mockClient);
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
            await FtpService.getThumbnails({ dir: "/media", names: ["photo.PNG"], authUser, callback });
            expect(callback).toHaveBeenCalledWith({ name: "photo.PNG", thumbnail });
            expect(mockClient.createReadStream).toHaveBeenCalledWith("/media/photo.PNG", { start: 0, end: 9 });
        });

        it("returns null when the generator response exceeds the allowed size", async () => {
            vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(Buffer.alloc(5 * 1024 * 1024 + 1)))));
            const callback = vi.fn();
            await FtpService.getThumbnails({ dir: "/media", names: ["oversized.mp4"], authUser, callback });
            expect(callback).toHaveBeenCalledWith({ name: "oversized.mp4", thumbnail: null });
            expect(mockCloseClient).toHaveBeenCalledWith(mockClient);
        });

        it("returns null when a thumbnail cannot be generated", async () => {
            mockClient.stat.mockRejectedValue(new Error("missing"));
            const callback = vi.fn();
            await FtpService.getThumbnails({ dir: "/media", names: ["missing.mp4"], authUser, callback });
            expect(mockClient.stat).toHaveBeenCalledWith("/media/missing.mp4");
            expect(callback).toHaveBeenCalledWith({ name: "missing.mp4", thumbnail: null });
            expect(mockCloseClient).toHaveBeenCalledWith(mockClient);
        });

    });

    describe("makeDir", () => {
        it("should create a directory", async () => {
            await expect(FtpService.makeDir({ dir: "/files", name: "images", authUser })).resolves.toBeUndefined();
            expect(mockClient.list).toHaveBeenCalledWith("/files");
            expect(mockClient.mkdir).toHaveBeenCalledWith("/files/images");
        });

        it("should generate a copy name when directory already exists", async () => {
            mockClient.list.mockResolvedValue([{ name: "images" }]);
            await expect(FtpService.makeDir({ dir: "/files", name: "images", authUser })).resolves.toBeUndefined();
            expect(mockClient.mkdir).toHaveBeenCalledWith("/files/copia_images");
        });

        it("should generate incremental copy names", async () => {
            mockClient.list.mockResolvedValue([
                { name: "images" },
                { name: "copia_images" },
                { name: "copia1_images" }
            ]);
            await FtpService.makeDir({ dir: "/files", name: "images", authUser });
            expect(mockClient.mkdir).toHaveBeenCalledWith("/files/copia2_images");
        });
    });

    describe("move", () => {
        it("should move entries and avoid destination name collisions", async () => {
            mockClient.list.mockResolvedValue([{ name: "file.txt" }]);
            const entries = [{ name: "file.txt", type: "FILE" }];
            await expect(
                FtpService.move({ dir: "/files", destination: "/backup", entries, authUser })
            ).resolves.toEqual({ lastContent: ["file.txt"], movedContent: [{ name: "copia_file.txt", type: "FILE" }] });
            expect(mockClient.list).toHaveBeenCalledWith("/backup");
            expect(mockClient.rename).toHaveBeenCalledWith("/files/file.txt", "/backup/copia_file.txt");
        });

        it("should move multiple entries using incremental collision names", async () => {
            mockClient.list.mockResolvedValue([{ name: "image.png" }]);
            const entries = [
                { name: "image.png", type: "FILE" },
                { name: "image.png", type: "FILE" }
            ];
            await expect(
                FtpService.move({ dir: "/files", destination: "/backup", entries, authUser })
            ).resolves.toEqual({
                lastContent: ["image.png", "image.png"],
                movedContent: [
                    { name: "copia_image.png", type: "FILE" },
                    { name: "copia1_image.png", type: "FILE" }
                ]
            });
        });
    });

    describe("rename", () => {
        it("should rename an entry", async () => {
            const entry = { name: "file.txt", type: "FILE" };
            await expect(
                FtpService.rename({ dir: "/files", entry, newName: "renamed.txt", authUser })
            ).resolves.toEqual({ name: "renamed.txt", type: "FILE" });
            expect(mockClient.list).toHaveBeenCalledWith("/files");
            expect(mockClient.rename).toHaveBeenCalledWith("/files/file.txt", "/files/renamed.txt");
        });

        it("should generate a copy name when new name already exists", async () => {
            mockClient.list.mockResolvedValue([{ name: "renamed.txt" }]);
            await FtpService.rename({
                dir: "/files",
                entry: { name: "file.txt", type: "FILE" },
                newName: "renamed.txt",
                authUser
            });
            expect(mockClient.rename).toHaveBeenCalledWith("/files/file.txt", "/files/copia_renamed.txt");
        });
    });

    describe("upload", () => {
        it("should throw when file is missing", async () => {
            await expect(FtpService.upload({ dir: "/upload", authUser })).rejects.toThrow(
                "Debe proporcionar un archivo"
            );
        });

        it("should upload a regular file", async () => {
            const file = { originalname: "test.txt", mimetype: "text/plain", stream: Readable.from("hello") };
            await expect(FtpService.upload({ dir: "/upload", file, authUser })).resolves.toBeUndefined();
            expect(mockClient.list).toHaveBeenCalledWith("/upload");
            expect(mockClient.put).toHaveBeenCalledWith(file.stream, "/upload/test.txt");
            expect(mockCompressionUtils.executeUpload).not.toHaveBeenCalled();
        });

        it("should rename uploaded file when it already exists", async () => {
            const file = { originalname: "test.txt", mimetype: "text/plain", stream: Readable.from("hello") };
            mockClient.list.mockResolvedValue([{ name: "test.txt" }]);
            await expect(FtpService.upload({ dir: "/upload", file, authUser })).resolves.toBeUndefined();
            expect(mockClient.put).toHaveBeenCalledWith(file.stream, "/upload/copia_test.txt");
        });

        it("should upload zip content", async () => {
            const file = { originalname: "test.zip", mimetype: "application/zip", stream: Readable.from("zip") };
            const logo = Readable.from("logo");
            const nested = Readable.from("nested");
            mockClient.list.mockResolvedValue([{ name: "images" }]);
            mockCompressionUtils.executeUpload.mockImplementation(async ({ callback }) => {
                await callback({ name: "images", isDirectory: true });
                await callback({ name: "images/nested.jpg", isDirectory: false, stream: nested });
                await callback({ name: "logo.png", isDirectory: false, stream: logo });
            });
            await expect(FtpService.upload({ dir: "/upload", extract: true, file, authUser })).resolves.toBeUndefined();
            expect(mockCompressionUtils.executeUpload).toHaveBeenCalledWith({
                stream: file.stream,
                callback: expect.any(Function)
            });
            expect(mockClient.list).toHaveBeenCalledOnce();
            expect(mockClient.mkdir).toHaveBeenCalledWith("/upload/copia_images");
            expect(mockClient.put).toHaveBeenCalledWith(nested, "/upload/copia_images/nested.jpg");
            expect(mockClient.put).toHaveBeenCalledWith(logo, "/upload/logo.png");
        });

        it("should preserve invalid ZIP path errors", async () => {
            const file = { originalname: "test.zip", mimetype: "application/zip", stream: Readable.from("zip") };
            const error = Object.assign(new Error("El ZIP contiene una ruta no válida"), { code: "ZIP_INVALID_PATH" });
            mockCompressionUtils.executeUpload.mockRejectedValue(error);
            await expect(FtpService.upload({ dir: "/upload", extract: true, file, authUser })).rejects.toBe(error);
            expect(mockCloseClient).toHaveBeenCalledWith(mockClient);
        });
    });

    describe("delete", () => {
        it("should delete files", async () => {
            const entries = [{ name: "test.txt", type: "FILE" }];
            await expect(FtpService.delete({ dir: "/files", entries, authUser })).resolves.toBeUndefined();
            expect(mockClient.delete).toHaveBeenCalledWith("/files/test.txt");
        });

        it("should delete directories", async () => {
            const entries = [{ name: "images", type: "DIR" }];
            await expect(FtpService.delete({ dir: "/files", entries, authUser })).resolves.toBeUndefined();
            expect(mockClient.rmdir).toHaveBeenCalledWith("/files/images", true);
        });
    });

    describe("download", () => {
        it("should download a single file", async () => {
            const stream = new PassThrough();
            mockClient.get.mockImplementation(async (remotePath, destination) => destination.end("content"));
            await expect(FtpService.download({
                dir: "/files",
                entries: [{ name: "file.txt", type: "FILE" }],
                authUser,
                stream
            })).resolves.toBeUndefined();
            expect(mockClient.get).toHaveBeenCalledWith("/files/file.txt", stream);
            expect(mockCompressionUtils.executeDownload).not.toHaveBeenCalled();
        });

        it("should create zip for multiple resources", async () => {
            const stream = new PassThrough();
            const receivedEntries = [];
            mockClient.list.mockImplementation(async (remotePath) =>
                remotePath === "/files/docs" ? [{ name: "nested.txt", type: "-" }] : []
            );
            mockClient.get.mockImplementation(async (remotePath, destination) => destination.end(remotePath));
            mockCompressionUtils.executeDownload.mockImplementation(async ({ entries, callback }) => {
                for await (const entry of entries) {
                    receivedEntries.push(entry);
                    if (entry.type === "FILE") {
                        await callback(entry, new PassThrough());
                    }
                }
            });
            await expect(FtpService.download({
                dir: "/files",
                entries: [
                    { name: "file1.txt", type: "FILE" },
                    { name: "docs", type: "DIR" }
                ],
                authUser,
                stream
            })).resolves.toBeUndefined();
            expect(receivedEntries).toEqual([
                { name: "file1.txt", type: "FILE", remotePath: "/files/file1.txt" },
                { name: "docs", type: "DIR", remotePath: "/files/docs" },
                { name: "docs/nested.txt", type: "FILE", remotePath: "/files/docs/nested.txt" }
            ]);
            expect(mockClient.list).toHaveBeenCalledWith("/files/docs");
            expect(mockClient.get).toHaveBeenCalledTimes(2);
            expect(mockCompressionUtils.executeDownload).toHaveBeenCalledWith({
                entries: expect.anything(),
                stream,
                callback: expect.any(Function)
            });
        });
    });
});
