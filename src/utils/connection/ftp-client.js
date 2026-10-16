import SftpClient from "ssh2-sftp-client";
import { ENV } from "../../config/environment.js";
import { SECRETS } from "../../config/secrets.js";

const { ftpHost, ftpPort } = ENV;

/**
 * Handles SFTP client connections through the FTP service contract
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpClient {
    /**
     * Returns a connected SFTP client
     *
     * @param {string} ownerId User identifier
     * @returns {Promise<SftpClient>} Connected SFTP client
     */
    static async getClient(ownerId) {
        const client = new SftpClient();
        await client.connect({
            host: ftpHost,
            port: ftpPort,
            username: FtpClient.#normalizeUsername(ownerId),
            privateKey: SECRETS.sftpKey
        });
        return client;
    }

    static #normalizeUsername(ownerId) {
        return ownerId.replaceAll("-", "");
    }

    /**
     * Closes an SFTP client
     *
     * @param {SftpClient | undefined} client SFTP client
     */
    static async closeClient(client) {
        if (client) {
            await client.end();
        }
    }
}
