import fs from "fs";

export const SECRETS = {
    passDb: readSecret(process.env.PASSDB)
}

function readSecret(path) {
    return fs.readFileSync(path, "utf8").trim()
}