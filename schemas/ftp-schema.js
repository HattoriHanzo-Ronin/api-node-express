import z from "zod";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * Factory for FTP validation schemas
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpSchema {
    static getDirSchema() {
        return z.object({ dir });
    }

    static getMakeDirSchema() {
        return z.object({ dir, name });
    }

    static getUploadSchema() {
        return z.object({ dir });
    }

    static getDownloadSchema() {
        return z.object({ dir, paths });
    }

    static getDeleteSchema() {
        return z.object({ path, type });
    }
}

const { ALLOW_ENUMS, ERROR_MESSAGES, REGEX, handleValidationIssues, zodEnumIgnoreCase } = ValidateUtils;
const { typeRequired, typeNotRequired, format, length, requiredEnum, invalidEnum } = ERROR_MESSAGES;
const { fileType } = ALLOW_ENUMS;
const { pathRegex } = REGEX;
const dir = safePath(
    z.string(typeNotRequired).trim().min(1, length(1, "min")).regex(pathRegex, format).nullable().default(null)
);
const name = z
    .string(typeRequired)
    .trim()
    .min(1, length(1, "min"))
    .regex(/^[\p{L}\p{N} ._-]+$/u, format);
const path = safePath(z.string(typeRequired).trim().min(1, length(1, "min")).regex(pathRegex, format));
const type = zodEnumIgnoreCase(z, z.enum(fileType, requiredEnum(invalidEnum("tipo de archivo", fileType))));
const paths = z.array(z.object({ type, name }), typeRequired).min(1);

function safePath(pathSchema) {
    return pathSchema.superRefine((path, ctx) => {
        handleValidationIssues(
            [
                {
                    condition: path && path.split("/").some((it) => it.trim() === ".."),
                    message: "Ruta no válida"
                }
            ],
            ctx
        );
    });
}
