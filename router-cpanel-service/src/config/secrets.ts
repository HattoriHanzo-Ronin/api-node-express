import fs from "node:fs";

const secretCache: Record<string, string> = {};
const SECRETS = Object.freeze({
    get jwtSecret() {
        return getSecret("jwtSecret", process.env.JWT_SECRET_FILE);
    }
});

function getSecret(key: string, secretFile: string | undefined): string {
    if (!secretFile) {
        throw new Error(`Missing secret file for ${key}`);
    }

    return (secretCache[key] ??= fs.readFileSync(secretFile, "utf8").trim());
}

export { SECRETS };
