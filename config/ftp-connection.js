import SftpClient from "ssh2-sftp-client";
import { ENV, SECRETS } from "./constants.js";

const { ftpHost, ftpPort } = ENV;

/**
 * Handles SFTP client connections through the FTP service contract
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpConnection {
    /**
     * Returns a connected SFTP client
     *
     * @param {string} username FTP username
     * @returns {Promise<SftpClient>} Connected SFTP client
     */
    static async getClient(username) {
        const client = new SftpClient();
        await client.connect({
            host: ftpHost,
            port: ftpPort,
            username,
            privateKey: SECRETS.sftpKey
        });
        return client;
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
