import SftpClient from "ssh2-sftp-client";
import { ENV } from "../../../config/environment.js";
import { SECRETS } from "../../../config/secrets.js";

/**
 * Handles SFTP client connections through the FTP service contract
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpClient {
    /**
     * Returns a connected SFTP client
     *
     * @param ownerId User identifier
     * @returns Connected SFTP client
     */
    static async getClient({ ownerId }: { ownerId: string }): Promise<SftpClient> {
        const { ftpHost, ftpPort } = ENV;
        const client = new SftpClient();
        await client.connect({
            host: ftpHost,
            port: ftpPort,
            username: FtpClient.normalizeUsername(ownerId),
            privateKey: SECRETS.sftpKey
        });
        return client;
    }

    /**
     * Closes an SFTP client
     *
     * @param params.client SFTP client
     */
    static async closeClient({ client }: { client: SftpClient }): Promise<void> {
        if (client) {
            await client.end();
        }
    }

    private static normalizeUsername(ownerId: string): string {
        return ownerId.replaceAll("-", "");
    }
}
