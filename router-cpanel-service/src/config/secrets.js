import fs from "node:fs";

const secretCache = {};
const SECRETS = Object.freeze({
    get jwtSecret() {
        return getSecret("jwtSecret", process.env.JWT_SECRET_FILE);
    }
});

function getSecret(key, secretFile) {
    return (secretCache[key] ??= fs.readFileSync(secretFile, "utf8").trim());
}

export { SECRETS };
