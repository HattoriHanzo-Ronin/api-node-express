import { describe, expect, it } from "vitest";
import FtpSchema from "../../src/schemas/ftp-schema.js";

const ID = "550e8400-e29b-41d4-a716-446655440000";

describe("FTP path validation", () => {
    it("rejects traversal in upload entries", () => {
        expect(
            FtpSchema.getCreateUploadSchema().safeParse({
                entries: [{ type: "FILE", path: "../outside" }]
            }).success
        ).toBe(false);
    });

    it.each([FtpSchema.getUploadEntrySchema, FtpSchema.getDownloadEntrySchema])(
        "rejects traversal in transfer paths",
        (getSchema) => {
            expect(getSchema().safeParse({ id: ID, path: "../outside" }).success).toBe(false);
            expect(getSchema().safeParse({ id: ID, path: "folder/file.txt" }).success).toBe(true);
        }
    );
});
