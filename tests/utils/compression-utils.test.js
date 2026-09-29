import { PassThrough, Readable } from "node:stream";
import AdmZip from "adm-zip";
import { describe, expect, it, vi } from "vitest";
import CompressionUtils from "../../src/utils/compression-utils.js";

vi.mock("../../src/config/constants.js", () => ({
    FILE_TYPE: { dir: "DIR", file: "FILE" }
}));

vi.mock("../../src/config/errors.js", () => ({
    API_ERROR: { zipInvalidPath: { code: "ZIP_INVALID_PATH" } }
}));

function createZip() {
    const zip = new AdmZip();
    zip.addFile("folder/", Buffer.alloc(0));
    zip.addFile("folder/file.txt", Buffer.from("content"));
    zip.addFile("implicit/nested/file.txt", Buffer.from("nested"));
    return zip.toBuffer();
}

async function getBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

async function* getEntries(entries) {
    for (const entry of entries) {
        yield entry;
    }
}

describe("CompressionUtils", () => {
    it("should extract ZIP entries sequentially preserving their directory structure", async () => {
        const entries = [];
        await CompressionUtils.executeUpload({
            stream: Readable.from(createZip()),
            callback: async (entry) => {
                entries.push({ ...entry, stream: entry.stream ? await getBuffer(entry.stream) : undefined });
            }
        });
        expect(entries).toEqual([
            { name: "folder", isDirectory: true, stream: undefined },
            { name: "folder/file.txt", isDirectory: false, stream: Buffer.from("content") },
            { name: "implicit", isDirectory: true, stream: undefined },
            { name: "implicit/nested", isDirectory: true, stream: undefined },
            { name: "implicit/nested/file.txt", isDirectory: false, stream: Buffer.from("nested") }
        ]);
    });

    it("should propagate upload callback errors", async () => {
        await expect(CompressionUtils.executeUpload({
            stream: Readable.from(createZip()),
            callback: async () => {
                throw new Error("Upload error");
            }
        })).rejects.toThrow("Upload error");
    });

    it("should reject unsafe ZIP paths", async () => {
        const zip = new AdmZip();
        zip.addFile("safe.txt", Buffer.from("unsafe"));
        const buffer = zip.toBuffer();
        const safeName = Buffer.from("safe.txt");
        const unsafeName = Buffer.from("../x.txt");
        let offset = buffer.indexOf(safeName);
        while (offset !== -1) {
            unsafeName.copy(buffer, offset);
            offset = buffer.indexOf(safeName, offset + safeName.length);
        }
        await expect(CompressionUtils.executeUpload({
            stream: Readable.from(buffer),
            callback: vi.fn()
        })).rejects.toMatchObject({
            status: 400,
            code: "ZIP_INVALID_PATH",
            message: "El ZIP contiene una ruta no válida"
        });
    });

    it("should create a ZIP stream preserving the supplied directory structure", async () => {
        const stream = new PassThrough();
        const output = getBuffer(stream);
        const entries = [
            { name: "dir2", type: "DIR" },
            { name: "dir2/dir3", type: "DIR" },
            { name: "dir2/dir3/file.txt", type: "FILE" }
        ];
        const callback = vi.fn(async (entry, destination) => {
            destination.end(Buffer.from("content"));
        });
        await CompressionUtils.executeDownload({
            entries: getEntries(entries),
            stream,
            callback
        });
        const zip = new AdmZip(await output);
        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith(entries[2], expect.any(PassThrough));
        expect(zip.getEntries().map(({ entryName }) => entryName)).toEqual([
            "dir2/",
            "dir2/dir3/",
            "dir2/dir3/file.txt"
        ]);
        expect(zip.readAsText("dir2/dir3/file.txt")).toBe("content");
    });

    it("should propagate download callback errors", async () => {
        const stream = new PassThrough();
        stream.resume();
        await expect(CompressionUtils.executeDownload({
            entries: [{ name: "file.txt", type: "FILE" }],
            stream,
            callback: async () => {
                throw new Error("Download error");
            }
        })).rejects.toThrow("Download error");
    });
});
