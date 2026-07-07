import SftpClient from "ssh2-sftp-client";
import { SECRETS } from "./constants.js";

/**
 * Handles SFTP client connections through the FTP service contract
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpConnection {
    static async getClient(username) {
        const client = new SftpClient();
        await client.connect({
            host: process.env.HOSTFTP,
            port: Number(process.env.PORTFTP),
            username,
            privateKey: SECRETS.sftpKey
        });
        return client;
    }

    static async closeClient(client) {
        if (client) {
            await client.end();
        }
    }
}
