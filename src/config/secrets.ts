import fs from "fs";
import { Secret } from "../types/config/secrets.js";

const secretCache: Record<string, string> = {};
const SECRETS: Secret = Object.freeze({
    get passDb() {
        return getSecret("passDb", process.env.PASSDB_FILE);
    },
    get jwtSecret() {
        return getSecret("jwtSecret", process.env.JWT_SECRET_FILE);
    },
    get refreshJwtSecret() {
        return getSecret("refreshJwtSecret", process.env.REFRESH_JWT_SECRET_FILE);
    },
    get sftpKey() {
        return getSecret("sftpKey", process.env.SFTP_KEY_FILE);
    }
});

function getSecret(key: string, secretFile: string | undefined): string {
    if (!secretFile) {
        throw new Error(`Missing secret file for ${key}`);
    }

    return (secretCache[key] ??= fs.readFileSync(secretFile, "utf8").trim());
}

export { SECRETS };
