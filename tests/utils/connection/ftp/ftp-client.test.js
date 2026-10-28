import { beforeEach, describe, expect, it, vi } from "vitest";

const { connect, end, SftpClient } = vi.hoisted(() => {
    const connect = vi.fn();
    const end = vi.fn();
    const SftpClient = vi.fn(function () {
        return { connect, end };
    });
    return { connect, end, SftpClient };
});

vi.mock("ssh2-sftp-client", () => ({ default: SftpClient }));
vi.mock("../../../../src/config/environment.js", () => ({
    ENV: { ftpHost: "ftp.example.com", ftpPort: 22 }
}));
vi.mock("../../../../src/config/secrets.js", () => ({
    SECRETS: { sftpKey: "private-key" }
}));

import FtpClient from "../../../../src/utils/connection/ftp/ftp-client.js";

describe("FtpClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should use the owner UUID without hyphens as the SFTP username", async () => {
        await FtpClient.getClient({ ownerId: "550e8400-e29b-41d4-a716-446655440000" });
        expect(connect).toHaveBeenCalledWith({
            host: "ftp.example.com",
            port: 22,
            username: "550e8400e29b41d4a716446655440000",
            privateKey: "private-key"
        });
    });

    it("should preserve an already normalized owner identifier", async () => {
        await FtpClient.getClient({ ownerId: "550e8400e29b41d4a716446655440000" });
        expect(connect).toHaveBeenCalledWith(expect.objectContaining({
            username: "550e8400e29b41d4a716446655440000"
        }));
    });

    it("should close a connected SFTP client", async () => {
        const client = await FtpClient.getClient({ ownerId: "550e8400-e29b-41d4-a716-446655440000" });
        await FtpClient.closeClient({ client });
        expect(end).toHaveBeenCalledOnce();
    });
});
