import z from "zod";
import ValidateUtils from "../utils/validate-utils.js";
import ZodUtils from "../utils/zod-utils.js";
import { FILE_TYPE } from "../config/constants.js";
import dirSchema, { pathSchema } from "./common/dir-schema.js";
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
        return withSuperRefine(z.object({ dir, entries, destination: dir }), moveCases);
    }

    static getRenameSchema() {
        return withSuperRefine(z.object({ dir, entry, newName: name }), renameCases);
    }

    static getCreateUploadSchema() {
        return z.object({ dir, entries: transferEntries });
    }

    static getUploadEntrySchema() {
        return z.object({ id: idSchema.shape.id, path: pathSchema, offset });
    }

    static getTransferSchema() {
        return idSchema;
    }

    static getCreateDownloadSchema() {
        return z.object({ dir, entries });
    }

    static getDownloadEntrySchema() {
        return z.object({ id: idSchema.shape.id, path: pathSchema, offset });
    }

    static getDeleteSchema() {
        return z.object({ dir, entries });
    }
}

const { handleValidationIssues, zodEnumIgnoreCase, withSuperRefine } = ZodUtils;
const { ERROR_MESSAGES } = ValidateUtils;
const { typeRequired, format, emptyArray, emptyString, invalidEnum } = ERROR_MESSAGES;
const fileType = Object.values(FILE_TYPE);
const { dir } = dirSchema.shape;
const name = z
    .string(typeRequired)
    .trim()
    .min(1, emptyString)
    .regex(/^[^\p{Cc}/\\]+$/u, format);
const entry = z.object({ type: zodEnumIgnoreCase(z, z.enum(fileType, invalidEnum(fileType)), typeRequired), name });
const entries = z.array(entry, typeRequired).min(1, emptyArray);
const offset = z.coerce.number().int().nonnegative().optional();
const transferEntry = z.object({
    type: zodEnumIgnoreCase(z, z.enum(fileType, invalidEnum(fileType)), typeRequired),
    path: pathSchema,
    size: z.number().int().nonnegative().optional()
});
const transferEntries = z.array(transferEntry, typeRequired).min(1, emptyArray);

function renameCases({ entry, newName }, ctx) {
    return handleValidationIssues(
        [{ condition: entry.name === newName, path: ["newName"], message: "El nuevo nombre debe ser diferente" }],
        ctx
    );
}

function moveCases({ dir, destination }, ctx) {
    return handleValidationIssues(
        [{ condition: dir === destination, path: ["destination"], message: "El destino debe ser diferente al origen" }],
        ctx
    );
}
