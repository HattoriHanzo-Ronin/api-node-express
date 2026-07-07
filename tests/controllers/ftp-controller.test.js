import { beforeEach, describe, expect, it, vi } from "vitest";
import FtpController from "../../controllers/ftp-controller.js";

describe("FtpController", () => {
    let ftpService;
    let controller;
    let req;
    let res;

    beforeEach(() => {
        ftpService = {
            dir: vi.fn(),
            makeDir: vi.fn(),
            move: vi.fn(),
            rename: vi.fn(),
            upload: vi.fn(),
            download: vi.fn(),
            delete: vi.fn()
        };
        controller = new FtpController({ ftpService });
        req = { params: {}, query: {}, body: {}, file: undefined, user: { username: "ronin" } };
        res = { status: vi.fn().mockReturnThis(), json: vi.fn(), download: vi.fn() };
    });

    describe("dir", () => {
        it("should list ftp resources", async () => {
            ftpService.dir.mockResolvedValue([{ name: "docs", type: "DIR" }]);
            req.query.dir = "   /files   ";
            await controller.dir(req, res);
            expect(ftpService.dir).toHaveBeenCalledWith({ dir: "/files", authUser: req.user });
            expect(res.json).toHaveBeenCalledWith([{ name: "docs", type: "DIR" }]);
        });

        it("should use default dir when missing", async () => {
            ftpService.dir.mockResolvedValue([]);
            await controller.dir(req, res);
            expect(ftpService.dir).toHaveBeenCalledWith({ dir: ".", authUser: req.user });
        });

        it("should fail when dir contains traversal", async () => {
            req.query.dir = "../secret";
            await expect(controller.dir(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });

    describe("makeDir", () => {
        it("should create a directory", async () => {
            ftpService.makeDir.mockResolvedValue({ name: "Nueva Carpeta", type: "DIR" });
            req.body = { dir: "/files", name: "   Nueva Carpeta   " };
            await controller.makeDir(req, res);
            expect(ftpService.makeDir).toHaveBeenCalledWith({
                dir: "/files",
                name: "Nueva Carpeta",
                authUser: req.user
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ name: "Nueva Carpeta", type: "DIR" });
        });

        it("should fail when name is missing", async () => {
            await expect(controller.makeDir(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail when name is empty", async () => {
            req.body.name = "";
            await expect(controller.makeDir(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail when name contains invalid characters", async () => {
            req.body.name = "carpeta<>";
            await expect(controller.makeDir(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });

    describe("move", () => {
        it("should move ftp entries", async () => {
            const entries = [{ name: "file.txt", type: "file" }];
            ftpService.move.mockResolvedValue({
                lastContent: ["file.txt"],
                movedContent: [{ name: "file.txt", type: "FILE" }]
            });
            req.body = { dir: "/files", destination: "/backup", entries };
            await controller.move(req, res);
            expect(ftpService.move).toHaveBeenCalledWith({
                dir: "/files",
                destination: "/backup",
                entries: [{ name: "file.txt", type: "FILE" }],
                authUser: req.user
            });
            expect(res.json).toHaveBeenCalledWith({
                lastContent: ["file.txt"],
                movedContent: [{ name: "file.txt", type: "FILE" }]
            });
        });

        it("should fail when destination contains traversal", async () => {
            req.body = { dir: "/files", destination: "../backup", entries: [{ name: "file.txt", type: "FILE" }] };
            await expect(controller.move(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });

    describe("rename", () => {
        it("should rename a ftp entry", async () => {
            ftpService.rename.mockResolvedValue({ name: "renamed.txt", type: "FILE" });
            req.body = { dir: "/files", entry: { name: "file.txt", type: "file" }, newName: "renamed.txt" };
            await controller.rename(req, res);
            expect(ftpService.rename).toHaveBeenCalledWith({
                dir: "/files",
                entry: { name: "file.txt", type: "FILE" },
                newName: "renamed.txt",
                authUser: req.user
            });
            expect(res.json).toHaveBeenCalledWith({ name: "renamed.txt", type: "FILE" });
        });

        it("should fail when new name is equal to current name", async () => {
            req.body = { entry: { name: "file.txt", type: "FILE" }, newName: "file.txt" };
            await expect(controller.rename(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });

    describe("upload", () => {
        it("should upload a file", async () => {
            const file = { originalname: "file.txt", buffer: Buffer.from("hello") };
            ftpService.upload.mockResolvedValue([{ name: "file.txt", type: "FILE" }]);
            req.body.dir = "/upload";
            req.file = file;
            await controller.upload(req, res);
            expect(ftpService.upload).toHaveBeenCalledWith({ dir: "/upload", file, authUser: req.user });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith([{ name: "file.txt", type: "FILE" }]);
        });
    });

    describe("download", () => {
        it("should download ftp entries", async () => {
            ftpService.download.mockResolvedValue("/tmp/file.txt");
            req.body = { dir: "/files", entries: [{ name: "file.txt", type: "file" }] };
            await controller.download(req, res);
            expect(ftpService.download).toHaveBeenCalledWith({
                dir: "/files",
                entries: [{ name: "file.txt", type: "FILE" }],
                authUser: req.user
            });
            expect(res.download).toHaveBeenCalledWith("/tmp/file.txt");
        });

        it("should fail with empty entries", async () => {
            req.body.entries = [];
            await expect(controller.download(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail when entry contains traversal", async () => {
            req.body.entries = [{ name: "../file.txt", type: "FILE" }];
            await expect(controller.download(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });

    describe("delete", () => {
        it("should delete ftp entries", async () => {
            const entries = [{ name: "file.txt", type: "file" }];
            ftpService.delete.mockResolvedValue(["file.txt"]);
            req.body = { dir: "/files", entries };
            await controller.delete(req, res);
            expect(ftpService.delete).toHaveBeenCalledWith({
                dir: "/files",
                entries: [{ name: "file.txt", type: "FILE" }],
                authUser: req.user
            });
            expect(res.json).toHaveBeenCalledWith(["file.txt"]);
        });

        it("should fail when entries are missing", async () => {
            await expect(controller.delete(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });
});
