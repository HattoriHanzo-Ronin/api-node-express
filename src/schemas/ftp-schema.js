import z from "zod";
import ValidateUtils from "../utils/validate-utils.js";
import dirSchema from "./common/dir-schema.js";
import idSchema from "./common/id-schema.js";

/**
 * Factory for FTP validation schemas
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpSchema {
    static getDirSchema() {
        return z.object({ dir });
    }

    static getMediaSchema() {
        return idSchema;
    }

    static getThumbnailSchema() {
        return z.object({ dir, name });
    }

    static getMakeDirSchema() {
        return z.object({ dir, name });
    }

    static getMoveSchema() {
        return z.object({ dir, entries, destination: dir });
    }

    static getRenameSchema() {
        return withSuperRefine(z.object({ dir, entry, newName: name }), renameCases);
    }

    static getUploadSchema() {
        return z.object({ dir, extract: z.enum(["true", "false"]).default("false").transform((it) => it === "true") });
    }

    static getDownloadSchema() {
        return z.object({ dir, entries });
    }

    static getDeleteSchema() {
        return z.object({ dir, entries });
    }
}

const { handleValidationIssues, zodEnumIgnoreCase, withSuperRefine } = ValidateUtils;
const { ALLOW_ENUMS, ERROR_MESSAGES } = ValidateUtils;
const { typeRequired, format, emptyArray, emptyString, invalidEnum } = ERROR_MESSAGES;
const { fileType } = ALLOW_ENUMS;
const { dir } = dirSchema.shape;
const name = z
    .string(typeRequired)
    .trim()
    .min(1, emptyString)
    .regex(/^[\p{L}\p{N} ._-]+$/u, format);
const entry = z.object({ type: zodEnumIgnoreCase(z, z.enum(fileType, invalidEnum(fileType)), typeRequired), name });
const entries = z.array(entry, typeRequired).min(1, emptyArray);

function renameCases({ entry, newName }, ctx) {
    return handleValidationIssues(
        [{ condition: entry.name === newName, path: ["newName"], message: "El nuevo nombre debe ser diferente" }],
        ctx
    );
}
