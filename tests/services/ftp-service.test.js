import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import path from "path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { promisify } from "node:util";
import { PassThrough, Readable } from "node:stream";
import ffmpegPath from "ffmpeg-static";

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

vi.mock("../../src/config/ftp-connection.js", () => ({
    default: { getClient: vi.fn(async () => mockClient), closeClient: mockCloseClient }
}));

vi.mock("../../src/utils/compression-utils.js", () => ({ default: mockCompressionUtils }));

import FtpConnection from "../../src/config/ftp-connection.js";
import FtpService from "../../src/services/ftp-service.js";

const mediaFs = await vi.importActual("node:fs/promises");

describe("FtpService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.list.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
            expect(FtpConnection.getClient).toHaveBeenCalledWith(authUser.username);
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
        const executeFile = promisify(execFile);
        let fixtureDir;
        beforeAll(async () => {
            fixtureDir = await mediaFs.mkdtemp(path.join(tmpdir(), "ftp-media-test-"));
            await executeFile(ffmpegPath, ["-f", "lavfi", "-i", "color=c=red:s=640x360", "-frames:v", "1", path.join(fixtureDir, "photo.PNG")]);
            await executeFile(ffmpegPath, ["-f", "lavfi", "-i", "testsrc2=s=360x640", "-t", "1", "-c:v", "mpeg4", path.join(fixtureDir, "video.mp4")]);
        });

        beforeEach(() => {
            vi.clearAllMocks();
            mockClient.stat.mockImplementation((remote) => mediaFs.stat(path.join(fixtureDir, path.posix.basename(remote))));
            mockClient.createReadStream.mockImplementation((remote, options) =>
                createReadStream(path.join(fixtureDir, path.posix.basename(remote)), options)
            );
        });

        afterAll(async () => {
            await mediaFs.rm(fixtureDir, { recursive: true, force: true });
        });

        it("returns real JPEG thumbnails for images and videos", async () => {
            const video = await mediaFs.readFile(path.join(fixtureDir, "video.mp4"));
            expect(video.indexOf(Buffer.from("moov"))).toBeGreaterThan(32768);
            const thumbnails = new Map();
            await FtpService.getThumbnails({
                dir: "/media",
                names: ["photo.PNG", "video.mp4"],
                authUser,
                callback: async ({ name, thumbnail }) => thumbnails.set(name, thumbnail)
            });
            for (const name of ["photo.PNG", "video.mp4"]) {
                const buffer = thumbnails.get(name);
                expect(Buffer.isBuffer(buffer)).toBe(true);
                expect(buffer.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
                const output = path.join(fixtureDir, `${name}.jpg`);
                await mediaFs.writeFile(output, buffer);
                const { stderr } = await executeFile(ffmpegPath, ["-i", output, "-f", "null", "-"]);
                expect(stderr).toContain(name === "photo.PNG" ? "320x180" : "180x320");
            }
            expect(mockClient.createReadStream).toHaveBeenCalledWith(
                "/media/photo.PNG",
                expect.objectContaining({ start: expect.any(Number), end: expect.any(Number) })
            );
            expect(mockClient.createReadStream).toHaveBeenCalledWith(
                "/media/video.mp4",
                expect.objectContaining({ start: expect.any(Number), end: expect.any(Number) })
            );
            expect(mockClient.get).not.toHaveBeenCalled();
            expect(FtpConnection.getClient).toHaveBeenCalledOnce();
            expect(mockCloseClient).toHaveBeenCalledWith(mockClient);
        });

        it("returns null when a thumbnail cannot be generated", async () => {
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
