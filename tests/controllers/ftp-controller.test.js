import { beforeEach, describe, expect, it, vi } from "vitest";
import FtpController from "../../src/controllers/ftp-controller.js";

describe("FtpController", () => {
    let ftpFacade;
    let controller;
    let req;
    let res;

    beforeEach(() => {
        ftpFacade = {
            dir: vi.fn(),
            getThumbnail: vi.fn(),
            makeDir: vi.fn(),
            move: vi.fn(),
            rename: vi.fn(),
            upload: vi.fn(),
            download: vi.fn(),
            delete: vi.fn()
        };
        controller = new FtpController({ ftpFacade });
        req = { params: {}, query: {}, body: {}, file: undefined, user: { id: "user-id", username: "ronin" } };
        res = { status: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(), type: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn(), download: vi.fn() };
    });

    describe("dir", () => {
        it("should list ftp resources", async () => {
            ftpFacade.dir.mockResolvedValue({ version: "5", data: [{ name: "docs", type: "DIR" }] });
            req.query.dir = "   /files   ";
            await controller.dir(req, res);
            expect(ftpFacade.dir).toHaveBeenCalledWith({ dir: "/files", authUser: req.user });
            expect(res.set).toHaveBeenCalledWith("Data-Version", "5");
            expect(res.json).toHaveBeenCalledWith([{ name: "docs", type: "DIR" }]);
        });

        it("should use default dir when missing", async () => {
            ftpFacade.dir.mockResolvedValue({ version: "5", data: [] });
            await controller.dir(req, res);
            expect(ftpFacade.dir).toHaveBeenCalledWith({ dir: ".", authUser: req.user });
        });

        it("should fail when dir contains traversal", async () => {
            req.query.dir = "../secret";
            await expect(controller.dir(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });

    describe("getThumbnail", () => {
        it("should return a cached JPEG thumbnail", async () => {
            const thumbnail = Buffer.from("thumbnail");
            req.params.name = "photo.jpg";
            req.query.dir = "/files";
            ftpFacade.getThumbnail.mockResolvedValue(thumbnail);
            await controller.getThumbnail(req, res);
            expect(ftpFacade.getThumbnail).toHaveBeenCalledWith({ dir: "/files", name: "photo.jpg", authUser: req.user });
            expect(res.type).toHaveBeenCalledWith("jpeg");
            expect(res.send).toHaveBeenCalledWith(thumbnail);
        });

        it("should fail when the file name is invalid", async () => {
            req.params.name = "../photo.jpg";
            req.query.dir = "/files";
            await expect(controller.getThumbnail(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should use root when dir is missing", async () => {
            req.params.name = "photo.jpg";
            await controller.getThumbnail(req, res);
            expect(ftpFacade.getThumbnail).toHaveBeenCalledWith({ dir: ".", name: "photo.jpg", authUser: req.user });
        });
    });

    describe("makeDir", () => {
        it("should create a directory", async () => {
            ftpFacade.makeDir.mockResolvedValue({ name: "Nueva Carpeta", type: "DIR" });
            req.body = { dir: "/files", name: "   Nueva Carpeta   " };
            await controller.makeDir(req, res);
            expect(ftpFacade.makeDir).toHaveBeenCalledWith({
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
            ftpFacade.move.mockResolvedValue({
                lastContent: ["file.txt"],
                movedContent: [{ name: "file.txt", type: "FILE" }]
            });
            req.body = { dir: "/files", destination: "/backup", entries };
            await controller.move(req, res);
            expect(ftpFacade.move).toHaveBeenCalledWith({
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
            ftpFacade.rename.mockResolvedValue({ name: "renamed.txt", type: "FILE" });
            req.body = { dir: "/files", entry: { name: "file.txt", type: "file" }, newName: "renamed.txt" };
            await controller.rename(req, res);
            expect(ftpFacade.rename).toHaveBeenCalledWith({
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
            ftpFacade.upload.mockResolvedValue([{ name: "file.txt", type: "FILE" }]);
            req.body.dir = "/upload";
            req.file = file;
            await controller.upload(req, res);
            expect(ftpFacade.upload).toHaveBeenCalledWith({ dir: "/upload", file, authUser: req.user });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith([{ name: "file.txt", type: "FILE" }]);
        });
    });

    describe("download", () => {
        it("should download ftp entries", async () => {
            ftpFacade.download.mockResolvedValue("/tmp/file.txt");
            req.body = { dir: "/files", entries: [{ name: "file.txt", type: "file" }] };
            await controller.download(req, res);
            expect(ftpFacade.download).toHaveBeenCalledWith({
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
            ftpFacade.delete.mockResolvedValue(["file.txt"]);
            req.body = { dir: "/files", entries };
            await controller.delete(req, res);
            expect(ftpFacade.delete).toHaveBeenCalledWith({
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
