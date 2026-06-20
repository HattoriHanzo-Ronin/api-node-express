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

const { ALLOW_ENUMS, ERROR_MESSAGES, REGEX, handleValidationIssues, zodEnumIgnoreCase, withSuperRefine } =
    ValidateUtils;
const { typeRequired, typeNotRequired, format,  emptyArray, emptyString, invalidEnum } =
    ERROR_MESSAGES;
const { fileType } = ALLOW_ENUMS;
const { pathRegex } = REGEX;
const dir = withSuperRefine(
    z.string(typeNotRequired).trim().min(1, emptyString).regex(pathRegex, format).nullable().default(null),
    cases
);
const name = z
    .string(typeRequired)
    .trim()
    .min(1, emptyString)
    .regex(/^[\p{L}\p{N} ._-]+$/u, format);
const path = withSuperRefine(z.string(typeRequired).trim().min(1, emptyString).regex(pathRegex, format), cases);
const type = zodEnumIgnoreCase(z, z.enum(fileType, invalidEnum(fileType)), typeRequired);
const paths = z.array(z.object({ type, name }), typeRequired).min(1, emptyArray);

function cases(data, ctx) {
    const { path } = data;
    return handleValidationIssues(
        [
            {
                condition: path && path.split("/").some((it) => it.trim() === ".."),
                message: "Ruta no válida"
            }
        ],
        ctx
    );
}
