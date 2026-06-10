import fs from "fs";

export const SECRETS = {
    passDb: readSecret(process.env.PASSDB_FILE),
    jwtSecret: readSecret(process.env.JWT_SECRET_FILE),
    refreshJwtSecret: readSecret(process.env.REFRESH_JWT_SECRET_FILE)
}

function readSecret(path) {
    return fs.readFileSync(path, "utf8").trim()
}