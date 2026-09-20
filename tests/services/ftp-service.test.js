import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import path from "path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const authUser = { username: "ronin" };
const { mockClient, mockCloseClient } = vi.hoisted(() => ({
    mockClient: {
        list: vi.fn(),
        get: vi.fn(),
        mkdir: vi.fn(),
        rename: vi.fn(),
        put: vi.fn(),
        fastPut: vi.fn(),
        fastGet: vi.fn(),
        delete: vi.fn(),
        rmdir: vi.fn()
    },
    mockCloseClient: vi.fn()
}));
const mockZip = {
    addLocalFolder: vi.fn(),
    writeZipPromise: vi.fn().mockResolvedValue(undefined),
    extractAllTo: vi.fn()
};

vi.mock("../../src/config/ftp-connection.js", () => ({
    default: { getClient: vi.fn(async () => mockClient), closeClient: mockCloseClient }
}));

vi.mock("adm-zip", () => ({
    default: class MockZip {
        constructor() {
            return mockZip;
        }
    }
}));

vi.mock("fs/promises", () => ({
    default: { mkdir: vi.fn(), rm: vi.fn(), readdir: vi.fn() }
}));

import fs from "fs/promises";
import FtpConnection from "../../src/config/ftp-connection.js";
import FtpService from "../../src/services/ftp-service.js";

const mediaFs = await vi.importActual("node:fs/promises");

describe("FtpService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.list.mockResolvedValue([]);
        mockZip.writeZipPromise.mockResolvedValue(undefined);
        vi.spyOn(Date, "now").mockReturnValue(1783417469000);
        vi.spyOn(global, "setTimeout").mockImplementation(() => 0);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("dir", () => {
        it("should list ftp resources", async () => {
            mockClient.list.mockResolvedValue([
                { name: "docs", type: "d" },
                { name: "file.txt", type: "-" }
            ]);
            await expect(FtpService.dir({ dir: "/files", authUser })).resolves.toEqual([
                { name: "docs", type: "DIR" },
                { name: "file.txt", type: "FILE" }
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

    describe("getThumbails", () => {
        const executeFile = promisify(execFile);
        let fixtureDir;
        beforeAll(async () => {
            fixtureDir = await mediaFs.mkdtemp(path.join(tmpdir(), "ftp-media-test-"));
            await executeFile(ffmpegPath, ["-f", "lavfi", "-i", "color=c=red:s=640x360", "-frames:v", "1", path.join(fixtureDir, "photo.PNG")]);
            await executeFile(ffmpegPath, ["-f", "lavfi", "-i", "testsrc2=s=360x640", "-t", "1", "-c:v", "mpeg4", path.join(fixtureDir, "video.mp4")]);
        });

        beforeEach(() => {
            vi.clearAllMocks();
            mockClient.get.mockImplementation((remote) => mediaFs.readFile(path.join(fixtureDir, path.posix.basename(remote))));
        });

        afterAll(async () => {
            await mediaFs.rm(fixtureDir, { recursive: true, force: true });
        });

        it("returns real JPEG thumbnails and continues after corrupt or unavailable files", async () => {
            await mediaFs.writeFile(path.join(fixtureDir, "broken.jpg"), "invalid image");
            const names = ["photo.PNG", "broken.jpg", "missing.mp4", "video.mp4", "notes.txt"];
            const video = await mediaFs.readFile(path.join(fixtureDir, "video.mp4"));
            expect(video.indexOf(Buffer.from("moov"))).toBeGreaterThan(32768);
            const result = await FtpService.getThumbails({ dir: "/media", names, authUser });
            expect(result).toBeInstanceOf(Map);
            expect([...result.keys()]).toEqual(["photo.PNG", "broken.jpg", "missing.mp4", "video.mp4", "notes.txt"]);
            expect(result.get("notes.txt")).toBeNull();
            expect(result.get("broken.jpg")).toBeNull();
            expect(result.get("missing.mp4")).toBeNull();
            for (const name of ["photo.PNG", "video.mp4"]) {
                const buffer = result.get(name);
                expect(Buffer.isBuffer(buffer)).toBe(true);
                expect(buffer.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
                const output = path.join(fixtureDir, `${name}.jpg`);
                await mediaFs.writeFile(output, buffer);
                const { stderr } = await executeFile(ffmpegPath, ["-i", output, "-f", "null", "-"]);
                expect(stderr).toContain(name === "photo.PNG" ? "320x180" : "180x320");
            }
            expect(mockCloseClient).toHaveBeenCalledWith(mockClient);
        });

        it("returns an empty map for a directory without media", async () => {
            await expect(FtpService.getThumbails({ dir: ".", names: [], authUser })).resolves.toEqual(new Map());
            expect(mockClient.list).not.toHaveBeenCalled();
            expect(mockClient.get).not.toHaveBeenCalled();
            expect(mockCloseClient).not.toHaveBeenCalled();
        });

    });

    describe("makeDir", () => {
        it("should create a directory", async () => {
            await expect(FtpService.makeDir({ dir: "/files", name: "images", authUser })).resolves.toEqual({
                name: "images",
                type: "DIR"
            });
            expect(mockClient.list).toHaveBeenCalledWith("/files");
            expect(mockClient.mkdir).toHaveBeenCalledWith("/files/images");
        });

        it("should generate a copy name when directory already exists", async () => {
            mockClient.list.mockResolvedValue([{ name: "images" }]);
            await expect(FtpService.makeDir({ dir: "/files", name: "images", authUser })).resolves.toEqual({
                name: "copia_images",
                type: "DIR"
            });
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
            const file = { originalname: "test.txt", mimetype: "text/plain", buffer: Buffer.from("hello") };
            await expect(FtpService.upload({ dir: "/upload", file, authUser })).resolves.toEqual([
                { name: "test.txt", type: "FILE" }
            ]);
            expect(mockClient.list).toHaveBeenCalledWith("/upload");
            expect(mockClient.put).toHaveBeenCalledWith(file.buffer, "/upload/test.txt");
            expect(mockZip.extractAllTo).not.toHaveBeenCalled();
            expect(mockClient.fastPut).not.toHaveBeenCalled();
        });

        it("should rename uploaded file when it already exists", async () => {
            const file = { originalname: "test.txt", mimetype: "text/plain", buffer: Buffer.from("hello") };
            mockClient.list.mockResolvedValue([{ name: "test.txt" }]);
            await expect(FtpService.upload({ dir: "/upload", file, authUser })).resolves.toEqual([
                { name: "copia_test.txt", type: "FILE" }
            ]);
            expect(mockClient.put).toHaveBeenCalledWith(file.buffer, "/upload/copia_test.txt");
        });

        it("should upload zip content", async () => {
            const file = { originalname: "test.zip", mimetype: "application/zip", buffer: Buffer.from("zip") };
            fs.readdir
                .mockResolvedValueOnce([
                    { name: "images", isDirectory: () => true },
                    { name: "logo.png", isDirectory: () => false }
                ])
                .mockResolvedValueOnce(["file1.jpg"])
                .mockResolvedValueOnce([{ name: "nested.jpg", isDirectory: () => false }]);
            await expect(FtpService.upload({ dir: "/upload", file, authUser })).resolves.toEqual([
                { name: "images", type: "DIR" },
                { name: "logo.png", type: "FILE" }
            ]);
            expect(mockZip.extractAllTo).toHaveBeenCalledWith(`${process.cwd()}/temp1783417469000`, true);
            expect(mockClient.mkdir).toHaveBeenCalledWith("/upload/images");
            expect(mockClient.fastPut).toHaveBeenCalledWith(expect.stringContaining("logo.png"), "/upload/logo.png");
            expect(fs.rm).toHaveBeenCalledWith(`${process.cwd()}/temp1783417469000`, { recursive: true, force: true });
        });
    });

    describe("delete", () => {
        it("should delete files", async () => {
            const entries = [{ name: "test.txt", type: "FILE" }];
            await expect(FtpService.delete({ dir: "/files", entries, authUser })).resolves.toEqual(["test.txt"]);
            expect(mockClient.delete).toHaveBeenCalledWith("/files/test.txt");
        });

        it("should delete directories", async () => {
            const entries = [{ name: "images", type: "DIR" }];
            await expect(FtpService.delete({ dir: "/files", entries, authUser })).resolves.toEqual(["images"]);
            expect(mockClient.rmdir).toHaveBeenCalledWith("/files/images", true);
        });
    });

    describe("download", () => {
        it("should download a single file", async () => {
            const result = await FtpService.download({
                dir: "/files",
                entries: [{ name: "file.txt", type: "FILE" }],
                authUser
            });
            expect(fs.mkdir).toHaveBeenCalledWith(`${process.cwd()}/temp1783417469000`);
            expect(mockClient.fastGet).toHaveBeenCalledWith("/files/file.txt", `${process.cwd()}/temp1783417469000/file.txt`);
            expect(result).toBe(`${process.cwd()}/temp1783417469000/file.txt`);
        });

        it("should create zip for multiple resources", async () => {
            const result = await FtpService.download({
                dir: "/files",
                entries: [
                    { name: "file1.txt", type: "FILE" },
                    { name: "docs", type: "DIR" }
                ],
                authUser
            });
            expect(fs.mkdir).toHaveBeenCalledWith(`${process.cwd()}/temp1783417469000/toZip`);
            expect(mockClient.fastGet).toHaveBeenCalledWith(
                "/files/file1.txt",
                path.join(`${process.cwd()}/temp1783417469000/toZip`, "file1.txt")
            );
            expect(mockClient.list).toHaveBeenCalledWith("/files/docs");
            expect(mockZip.addLocalFolder).toHaveBeenCalledWith(`${process.cwd()}/temp1783417469000/toZip`);
            expect(mockZip.writeZipPromise).toHaveBeenCalledWith(
                `${process.cwd()}/temp1783417469000/1783417469000.zip`
            );
            expect(result).toBe(`${process.cwd()}/temp1783417469000/1783417469000.zip`);
        });
    });
});
