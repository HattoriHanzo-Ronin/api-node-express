import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClient = {
    cd: vi.fn(),
    list: vi.fn(),
    ensureDir: vi.fn(),
    uploadFrom: vi.fn(),
    uploadFromDir: vi.fn(),
    downloadTo: vi.fn(),
    downloadToDir: vi.fn(),
    remove: vi.fn(),
    removeDir: vi.fn()
};
const mockZip = {
    addLocalFolder: vi.fn(),
    writeZipPromise: vi.fn().mockResolvedValue(undefined),
    extractAllTo: vi.fn()
};

vi.mock("../../config/ftp-connection.js", () => ({
    default: { getClient: vi.fn(async () => mockClient), closeClient: vi.fn() }
}));

import FtpService from "../../services/ftp-service.js";

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

describe("FtpService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.list.mockReset();
        mockClient.cd.mockReset();
        mockClient.ensureDir.mockReset();
        mockClient.uploadFrom.mockReset();
        mockClient.uploadFromDir.mockReset();
        mockClient.downloadTo.mockReset();
        mockClient.downloadToDir.mockReset();
        mockClient.remove.mockReset();
        mockClient.removeDir.mockReset();
        mockZip.addLocalFolder.mockReset();
        mockZip.writeZipPromise.mockReset();
        mockZip.writeZipPromise.mockResolvedValue(undefined);
        mockZip.extractAllTo.mockReset();
    });

    describe("dir", () => {
        it("should list ftp resources", async () => {
            mockClient.list.mockResolvedValue([
                { name: "docs", isDirectory: true },
                { name: "file.txt", isDirectory: false }
            ]);
            const result = await FtpService.dir({
                dir: "/files"
            });
            expect(mockClient.cd).toHaveBeenCalledWith("/files");
            expect(result).toEqual([
                { name: "docs", type: "DIR" },
                { name: "file.txt", type: "FILE" }
            ]);
        });
    });

    describe("makeDir", () => {
        it("should create a directory", async () => {
            mockClient.list.mockResolvedValue([]);

            await FtpService.makeDir({
                dir: "/files",
                name: "images"
            });

            expect(mockClient.cd).toHaveBeenCalledWith("/files");

            expect(mockClient.ensureDir).toHaveBeenCalledWith("images");
        });

        it("should generate a copy name when directory already exists", async () => {
            mockClient.list.mockResolvedValue([{ name: "images" }]);

            await FtpService.makeDir({
                name: "images"
            });

            expect(mockClient.ensureDir).toHaveBeenCalledWith("copia_images");
        });

        it("should generate incremental copy names", async () => {
            mockClient.list.mockResolvedValue([
                { name: "images" },
                { name: "copia_images" },
                { name: "copia1_images" }
            ]);

            await FtpService.makeDir({
                name: "images"
            });

            expect(mockClient.ensureDir).toHaveBeenCalledWith("copia2_images");
        });
    });

    describe("upload", () => {
        it("should throw when file is missing", async () => {
            await expect(FtpService.upload({ dir: "/upload" })).rejects.toThrow("Debe proporcionar un archivo");
        });

        it("should upload a regular file", async () => {
            mockClient.list.mockResolvedValue([]);
            await FtpService.upload({
                dir: "/upload",
                file: { originalname: "test.txt", mimetype: "text/plain", buffer: Buffer.from("hello") }
            });
            expect(mockClient.cd).toHaveBeenCalledWith("/upload");
            expect(mockClient.uploadFrom).toHaveBeenCalledTimes(1);
            expect(mockZip.extractAllTo).not.toHaveBeenCalled();
            expect(mockClient.uploadFromDir).not.toHaveBeenCalled();
        });

        it("should upload zip content", async () => {
            mockClient.list.mockResolvedValue([]);
            fs.readdir
                .mockResolvedValueOnce([
                    { name: "images", isDirectory: () => true },
                    { name: "logo.png", isDirectory: () => false }
                ])
                .mockResolvedValueOnce(["file1.jpg"]);
            await FtpService.upload({
                file: { originalname: "test.zip", mimetype: "application/zip", buffer: Buffer.from("zip") }
            });
            expect(mockZip.extractAllTo).toHaveBeenCalled();
            expect(mockClient.ensureDir).toHaveBeenCalledWith("images");
            expect(mockClient.uploadFromDir).toHaveBeenCalledTimes(1);
            expect(mockClient.uploadFrom).toHaveBeenCalledTimes(1);
            expect(mockClient.uploadFrom).toHaveBeenCalledWith(expect.stringContaining("logo.png"), "logo.png");
        });
    });

    describe("delete", () => {
        it("should delete files", async () => {
            await FtpService.delete({ path: "test.txt", type: "FILE" });
            expect(mockClient.remove).toHaveBeenCalledWith("test.txt");
        });

        it("should delete directories", async () => {
            await FtpService.delete({ path: "images", type: "DIR" });
            expect(mockClient.removeDir).toHaveBeenCalledWith("images");
        });
    });

    describe("dowload", () => {
        it("should download a single file", async () => {
            const result = await FtpService.download({ paths: [{ name: "file.txt", type: "FILE" }] });
            expect(mockClient.downloadTo).toHaveBeenCalledTimes(1);
            expect(result).toContain("file.txt");
        });

        it("should create zip for multiple resources", async () => {
            const result = await FtpService.download({
                paths: [
                    { name: "file1.txt", type: "FILE" },
                    { name: "file2.txt", type: "FILE" }
                ]
            });
            expect(mockClient.downloadTo).toHaveBeenCalledTimes(2);
            expect(mockZip.addLocalFolder).toHaveBeenCalledTimes(1);
            expect(mockZip.writeZipPromise).toHaveBeenCalledTimes(1);
            expect(result).toContain(".zip");
        });
    });
});
