import fs from "fs";

export const SECRETS = {
    passDb: getContentFile(process.env.PASSDB)
}

function readSecret(path) {
    return fs.readFileSync(path, "utf8").trim()
}