import { describe, it, expect, vi, beforeEach } from "vitest";
import FtpController from "../../controllers/ftp-controller.js";

describe("FtpController validation", () => {
    let ftpService;
    let controller;
    let req;
    let res;

    beforeEach(() => {
        vi.clearAllMocks();
        ftpService = { dir: vi.fn(), makeDir: vi.fn(), download: vi.fn(), delete: vi.fn() };
        controller = new FtpController({ ftpService });
        req = { params: {}, query: {}, body: {}, file: {} };
        res = { status: vi.fn().mockReturnThis(), json: vi.fn(), download: vi.fn() };
    });

    it("should normalize file type", async () => {
        ftpService.download.mockResolvedValue("/tmp/file.txt");
        req.body.paths = [{ name: "file.txt", type: "file" }];
        await controller.download(req, res);
        expect(ftpService.download).toHaveBeenCalledWith({ dir: null, paths: [{ name: "file.txt", type: "FILE" }] });
    });

    it("should fail with invalid file type", async () => {
        req.body.paths = [{ name: "file.txt", type: "PATATA" }];
        await expect(controller.download(req, res)).rejects.toThrow();
    });

    it("should fail with empty paths", async () => {
        req.body.paths = [];
        await expect(controller.download(req, res)).rejects.toThrow();
    });

    it("should fail with invalid dir traversal", async () => {
        req.query.dir = "../secret";
        req.body.paths = [{ name: "file.txt", type: "FILE" }];
        await expect(controller.download(req, res)).rejects.toThrow();
    });

    it("should trim dir value", async () => {
        ftpService.download.mockResolvedValue("/tmp/file.txt");
        req.query.dir = "   /images   ";
        req.body.paths = [{ name: "file.txt", type: "FILE" }];
        await controller.download(req, res);
        expect(ftpService.download).toHaveBeenCalledWith({
            dir: "/images",
            paths: [{ name: "file.txt", type: "FILE" }]
        });
    });

    it("should fail when path name is empty", async () => {
        req.body.paths = [{ name: "", type: "FILE" }];
        await expect(controller.download(req, res)).rejects.toThrow();
    });

    it("should fail when path name only contains spaces", async () => {
        req.body.paths = [{ name: "     ", type: "FILE" }];
        await expect(controller.download(req, res)).rejects.toThrow();
    });

    it("should fail when path contains traversal", async () => {
        req.body.paths = [{ name: "../file.txt", type: "FILE" }];
        await expect(controller.download(req, res)).rejects.toThrow();
    });

    it("should normalize delete type", async () => {
        ftpService.delete.mockResolvedValue();
        req.query.path = "file.txt";
        req.params.type = "file";
        await controller.delete(req, res);
        expect(ftpService.delete).toHaveBeenCalledWith({ path: "file.txt", type: "FILE" });
    });

    it("should fail delete when path contains traversal", async () => {
        req.query.path = "../secret.txt";
        req.query.type = "FILE";
        await expect(controller.delete(req, res)).rejects.toThrow();
    });

    it("should fail delete when path is missing", async () => {
        req.query.type = "FILE";
        await expect(controller.delete(req, res)).rejects.toThrow();
    });

    it("should fail makeDir when name is missing", async () => {
        await expect(controller.makeDir(req, res)).rejects.toThrow();
    });

    it("should trim directory name", async () => {
        ftpService.makeDir.mockResolvedValue();
        req.body.name = "   Nueva Carpeta   ";
        await controller.makeDir(req, res);
        expect(ftpService.makeDir).toHaveBeenCalledWith({ dir: null, name: "Nueva Carpeta" });
    });

    it("should fail makeDir when name is empty", async () => {
        req.body.name = "";
        await expect(controller.makeDir(req, res)).rejects.toThrow();
    });

    it("should fail makeDir when name only contains spaces", async () => {
        req.body.name = "      ";
        await expect(controller.makeDir(req, res)).rejects.toThrow();
    });

    it("should fail makeDir when name contains invalid characters", async () => {
        req.body.name = "carpeta<>";
        await expect(controller.makeDir(req, res)).rejects.toThrow();
    });
});
