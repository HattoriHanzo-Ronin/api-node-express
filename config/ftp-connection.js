import ftp from "basic-ftp";

/**
 * Handles FTP client connections
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpConnection {
    static async getClient() {
        const client = new ftp.Client();

        await client.access({
            host: process.env.HOSTFTP,
            user: process.env.USERFTP,
            password: process.env.PASSFTP,
            secure: false
        });
        return client;
    }

    static closeClient(client) {
        if (client) {
            client.close();
        }
    }
}
