import { beforeEach, describe, expect, it, vi } from "vitest";
import FtpFacade from "../../src/facades/ftp-facade.js";

describe("FtpFacade", () => {
    let ftpService;
    let dataVersionsService;
    let tx;
    let ftpFacade;
    const clientTx = {};

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
        dataVersionsService = {
            getById: vi.fn().mockResolvedValue({ version: "5" }),
            increment: vi.fn()
        };
        tx = vi.fn(async (callback) => callback(clientTx));
        ftpFacade = new FtpFacade({ ftpService, dataVersionsService, tx });
    });

    describe("read operations", () => {
        it("should return directory content without incrementing its version", async () => {
            const data = { dir: "/files", authUser: { username: "ronin" } };
            ftpService.dir.mockResolvedValue([]);
            await expect(ftpFacade.dir(data)).resolves.toEqual({ version: "5", data: [] });
            expect(ftpService.dir).toHaveBeenCalledWith(data);
            expect(dataVersionsService.getById).toHaveBeenCalledWith({ id: "ftp" });
            expect(tx).not.toHaveBeenCalled();
            expect(dataVersionsService.increment).not.toHaveBeenCalled();
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
            ["makeDir", { name: "docs", type: "DIR" }],
            ["move", { lastContent: [], movedContent: [] }],
            ["rename", { name: "file.txt", type: "FILE" }],
            ["upload", [{ name: "file.txt", type: "FILE" }]],
            ["delete", ["file.txt"]]
        ])("should execute %s and increment the FTP version in a transaction", async (method, result) => {
            const data = { authUser: { username: "ronin" } };
            ftpService[method].mockResolvedValue(result);
            await expect(ftpFacade[method](data)).resolves.toEqual(result);
            expect(ftpService[method]).toHaveBeenCalledWith(data);
            expect(tx).toHaveBeenCalledOnce();
            expect(dataVersionsService.increment).toHaveBeenCalledWith({
                clientTx,
                id: "ftp"
            });
        });

        it("should not increment the FTP version when the operation fails", async () => {
            const data = { authUser: { username: "ronin" } };
            ftpService.delete.mockRejectedValue(new Error("FTP error"));
            await expect(ftpFacade.delete(data)).rejects.toThrow("FTP error");
            expect(dataVersionsService.increment).not.toHaveBeenCalled();
        });
    });
});
