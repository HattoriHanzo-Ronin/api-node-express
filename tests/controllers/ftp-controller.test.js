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
            streamMedia: vi.fn(),
            makeDir: vi.fn(),
            move: vi.fn(),
            rename: vi.fn(),
            createUpload: vi.fn(),
            uploadEntry: vi.fn(),
            completeUpload: vi.fn(),
            cancelTransfer: vi.fn(),
            createDownload: vi.fn(),
            downloadEntry: vi.fn(),
            delete: vi.fn()
        };
        controller = new FtpController({ ftpFacade });
        req = { params: {}, query: {}, body: {}, file: undefined, user: { id: "user-id", username: "ronin" } };
        res = { status: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(), type: vi.fn().mockReturnThis(), attachment: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };
    });

    describe("dir", () => {
        it("should list ftp resources", async () => {
            ftpFacade.dir.mockResolvedValue({ hash: "directory-hash", data: [{ name: "docs", type: "DIR" }] });
            req.query.dir = "   files   ";
            await controller.dir(req, res);
            expect(ftpFacade.dir).toHaveBeenCalledWith({ dir: "files", authUser: req.user });
            expect(res.set).toHaveBeenCalledWith("Data-Version", "directory-hash");
            expect(res.json).toHaveBeenCalledWith([{ name: "docs", type: "DIR" }]);
        });

        it("should use default dir when missing", async () => {
            ftpFacade.dir.mockResolvedValue({ hash: "directory-hash", data: [] });
            await controller.dir(req, res);
            expect(ftpFacade.dir).toHaveBeenCalledWith({ dir: ".", authUser: req.user });
        });

        it("should fail when dir contains traversal", async () => {
            req.query.dir = "../secret";
            await expect(controller.dir(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });

    describe("streamMedia", () => {
        it("should stream a temporary media range", async () => {
            req.params.id = "550e8400-e29b-41d4-a716-446655440000";
            req.headers = { range: "bytes=0-99" };
            req.method = "GET";
            await controller.streamMedia(req, res);
            expect(ftpFacade.streamMedia).toHaveBeenCalledWith({
                id: req.params.id,
                range: req.headers.range,
                method: req.method,
                stream: res
            });
        });

        it("should reject invalid media identifiers", async () => {
            req.params.id = "invalid";
            req.headers = {};
            await expect(controller.streamMedia(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });

    describe("getThumbnail", () => {
        it("should return a cached JPEG thumbnail", async () => {
            const thumbnail = Buffer.from("thumbnail");
            req.params.name = "photo.jpg";
            req.query.dir = "files";
            ftpFacade.getThumbnail.mockResolvedValue(thumbnail);
            await controller.getThumbnail(req, res);
            expect(ftpFacade.getThumbnail).toHaveBeenCalledWith({ dir: "files", name: "photo.jpg", authUser: req.user });
            expect(res.type).toHaveBeenCalledWith("jpeg");
            expect(res.send).toHaveBeenCalledWith(thumbnail);
        });

        it("should return no content when the file has no generated thumbnail", async () => {
            req.params.name = "photo.jpg";
            ftpFacade.getThumbnail.mockResolvedValue(null);
            await controller.getThumbnail(req, res);
            expect(res.status).toHaveBeenCalledWith(204);
            expect(res.type).not.toHaveBeenCalled();
            expect(res.send).toHaveBeenCalledWith();
        });

        it("should propagate pending thumbnail errors", async () => {
            req.params.name = "photo.jpg";
            ftpFacade.getThumbnail.mockRejectedValue(new Error("La miniatura se está generando"));
            await expect(controller.getThumbnail(req, res)).rejects.toThrow("La miniatura se está generando");
            expect(res.type).not.toHaveBeenCalled();
            expect(res.send).not.toHaveBeenCalled();
        });

        it("should fail when the file name is invalid", async () => {
            req.params.name = "../photo.jpg";
            req.query.dir = "files";
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
            const data = [{ name: "Nueva Carpeta", type: "DIR" }];
            ftpFacade.makeDir.mockResolvedValue({ hash: "directory-hash", data });
            req.body = { dir: "files", name: "   Nueva Carpeta   " };
            await controller.makeDir(req, res);
            expect(ftpFacade.makeDir).toHaveBeenCalledWith({
                dir: "files",
                name: "Nueva Carpeta",
                authUser: req.user
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.set).toHaveBeenCalledWith("Data-Version", "directory-hash");
            expect(res.json).toHaveBeenCalledWith(data);
        });

        it("should fail when name is missing", async () => {
            await expect(controller.makeDir(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail when name is empty", async () => {
            req.body.name = "";
            await expect(controller.makeDir(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should allow usual filename characters", async () => {
            req.body.name = "carpeta<>";
            ftpFacade.makeDir.mockResolvedValue({ hash: "directory-hash", data: [] });
            await expect(controller.makeDir(req, res)).resolves.toBeUndefined();
        });
    });

    describe("move", () => {
        it("should move ftp entries", async () => {
            const entries = [{ name: "file.txt", type: "file" }];
            const data = [{ name: "file.txt", type: "FILE" }];
            ftpFacade.move.mockResolvedValue({ hash: "directory-hash", data });
            req.body = { dir: "files", destination: "backup", entries };
            await controller.move(req, res);
            expect(ftpFacade.move).toHaveBeenCalledWith({
                dir: "files",
                destination: "backup",
                entries: [{ name: "file.txt", type: "FILE" }],
                authUser: req.user
            });
            expect(res.set).toHaveBeenCalledWith("Data-Version", "directory-hash");
            expect(res.json).toHaveBeenCalledWith(data);
        });

        it("should fail when destination contains traversal", async () => {
            req.body = { dir: "files", destination: "../backup", entries: [{ name: "file.txt", type: "FILE" }] };
            await expect(controller.move(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });

    describe("rename", () => {
        it("should rename a ftp entry", async () => {
            const data = [{ name: "renamed.txt", type: "FILE" }];
            ftpFacade.rename.mockResolvedValue({ hash: "directory-hash", data });
            req.body = { dir: "files", entry: { name: "file.txt", type: "file" }, newName: "renamed.txt" };
            await controller.rename(req, res);
            expect(ftpFacade.rename).toHaveBeenCalledWith({
                dir: "files",
                entry: { name: "file.txt", type: "FILE" },
                newName: "renamed.txt",
                authUser: req.user
            });
            expect(res.set).toHaveBeenCalledWith("Data-Version", "directory-hash");
            expect(res.json).toHaveBeenCalledWith(data);
        });

        it("should fail when new name is equal to current name", async () => {
            req.body = { entry: { name: "file.txt", type: "FILE" }, newName: "file.txt" };
            await expect(controller.rename(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });

    describe("upload", () => {
        it("should create an upload session", async () => {
            const session = { id: "550e8400-e29b-41d4-a716-446655440000", entries: [] };
            ftpFacade.createUpload.mockResolvedValue(session);
            req.body = { dir: "upload", entries: [{ path: "folder", type: "dir" }] };
            await controller.createUpload(req, res);
            expect(ftpFacade.createUpload).toHaveBeenCalledWith({
                dir: "upload",
                entries: [{ path: "folder", type: "DIR" }],
                authUser: req.user
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(session);
        });

        it("should upload one session file", async () => {
            req.params.id = "550e8400-e29b-41d4-a716-446655440000";
            req.query.path = "folder/file.txt";
            req.query.offset = "90";
            req.file = { stream: {} };
            ftpFacade.uploadEntry.mockResolvedValue({ nextOffset: 180 });
            await controller.uploadEntry(req, res);
            expect(ftpFacade.uploadEntry).toHaveBeenCalledWith({
                id: req.params.id,
                entryPath: req.query.path,
                offset: 90,
                file: req.file,
                authUser: req.user
            });
            expect(res.json).toHaveBeenCalledWith({ nextOffset: 180 });
        });
    });

    describe("download", () => {
        it("should create a download session", async () => {
            const session = { id: "550e8400-e29b-41d4-a716-446655440000", entries: [] };
            ftpFacade.createDownload.mockResolvedValue(session);
            req.body = { dir: "files", entries: [{ name: "file.txt", type: "file" }] };
            await controller.createDownload(req, res);
            expect(ftpFacade.createDownload).toHaveBeenCalledWith({
                dir: "files",
                entries: [{ name: "file.txt", type: "FILE" }],
                authUser: req.user
            });
            expect(res.json).toHaveBeenCalledWith(session);
        });

        it("should preserve the optional download offset contract", async () => {
            req.params.id = "550e8400-e29b-41d4-a716-446655440000";
            req.query = { path: "folder/file.txt", offset: "90" };
            await controller.downloadEntry(req, res);
            expect(ftpFacade.downloadEntry).toHaveBeenCalledWith({
                id: req.params.id,
                entryPath: req.query.path,
                offset: 90,
                authUser: req.user,
                stream: res
            });
        });

        it("should fail with empty entries", async () => {
            req.body.entries = [];
            await expect(controller.createDownload(req, res)).rejects.toThrow("Error al validar los datos");
        });

        it("should fail when entry contains traversal", async () => {
            req.body.entries = [{ name: "../file.txt", type: "FILE" }];
            await expect(controller.createDownload(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });

    describe("delete", () => {
        it("should delete ftp entries", async () => {
            const entries = [{ name: "file.txt", type: "file" }];
            const data = [];
            ftpFacade.delete.mockResolvedValue({ hash: "directory-hash", data });
            req.body = { dir: "files", entries };
            await controller.delete(req, res);
            expect(ftpFacade.delete).toHaveBeenCalledWith({
                dir: "files",
                entries: [{ name: "file.txt", type: "FILE" }],
                authUser: req.user
            });
            expect(res.set).toHaveBeenCalledWith("Data-Version", "directory-hash");
            expect(res.json).toHaveBeenCalledWith(data);
        });

        it("should fail when entries are missing", async () => {
            await expect(controller.delete(req, res)).rejects.toThrow("Error al validar los datos");
        });
    });
});
