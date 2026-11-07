import z, { type RefinementCtx } from "zod";
import type { FtpMoveSchemaData, FtpRenameSchemaData } from "../types/ftp-schema.js";
import ZodUtils from "../utils/zod-utils.js";
import { FILE_TYPE } from "../config/constants.js";
import { DIR_SCHEMA, PATH_SCHEMA } from "./common/dir-schema.js";
import idSchema from "./common/id-schema.js";

const {
    handleValidationIssues,
    zodEnumIgnoreCase,
    withSuperRefine,
    ERROR_MESSAGES: { typeRequired, format, emptyArray, emptyString, invalidEnum }
} = ZodUtils;
const FILE_TYPES = Object.values(FILE_TYPE);
const { dir } = DIR_SCHEMA.shape;
const NAME_SCHEMA = z
    .string(typeRequired)
    .trim()
    .min(1, emptyString)
    .regex(/^[^\p{Cc}/\\]+$/u, format);
const ENTRY_SCHEMA = z.object({
    type: zodEnumIgnoreCase(z.enum(FILE_TYPES, invalidEnum(FILE_TYPES)), typeRequired),
    name: NAME_SCHEMA
});
const ENTRIES_SCHEMA = z.array(ENTRY_SCHEMA, typeRequired).min(1, emptyArray);
const OFFSET_SCHEMA = z.coerce.number().int().nonnegative().optional();
const TRANSFER_ENTRY_SCHEMA = z.object({
    type: zodEnumIgnoreCase(z.enum(FILE_TYPES, invalidEnum(FILE_TYPES)), typeRequired),
    path: PATH_SCHEMA,
    size: z.number().int().nonnegative().optional()
});
const TRANSFER_ENTRIES_SCHEMA = z.array(TRANSFER_ENTRY_SCHEMA, typeRequired).min(1, emptyArray);

/**
 * Factory for FTP validation schemas
 *
 * @author HattoriHanzo-Ronin
 */
export default class FtpSchema {
    /**
     * Returns the directory schema
     *
     * @returns Validation schema
     */
    static getDirSchema(): z.ZodObject<{ dir: typeof dir }> {
        return z.object({ dir });
    }

    /**
     * Returns the media session schema
     *
     * @returns Validation schema
     */
    static getMediaSchema(): z.ZodObject<typeof idSchema.shape> {
        return idSchema;
    }

    /**
     * Returns the thumbnail schema
     *
     * @returns Validation schema
     */
    static getThumbnailSchema(): z.ZodObject<{ dir: typeof dir; name: typeof NAME_SCHEMA }> {
        return z.object({ dir, name: NAME_SCHEMA });
    }

    /**
     * Returns the directory creation schema
     *
     * @returns Validation schema
     */
    static getMakeDirSchema(): z.ZodObject<{ dir: typeof dir; name: typeof NAME_SCHEMA }> {
        return z.object({ dir, name: NAME_SCHEMA });
    }

    /**
     * Returns the move schema
     *
     * @returns Validation schema
     */
    static getMoveSchema(): z.ZodObject<{ dir: typeof dir; entries: typeof ENTRIES_SCHEMA; destination: typeof dir }> {
        return withSuperRefine(z.object({ dir, entries: ENTRIES_SCHEMA, destination: dir }), FtpSchema.moveCases);
    }

    /**
     * Returns the rename schema
     *
     * @returns Validation schema
     */
    static getRenameSchema(): z.ZodObject<{
        dir: typeof dir;
        entry: typeof ENTRY_SCHEMA;
        newName: typeof NAME_SCHEMA;
    }> {
        return withSuperRefine(z.object({ dir, entry: ENTRY_SCHEMA, newName: NAME_SCHEMA }), FtpSchema.renameCases);
    }

    /**
     * Returns the upload session schema
     *
     * @returns Validation schema
     */
    static getCreateUploadSchema(): z.ZodObject<{ dir: typeof dir; entries: typeof TRANSFER_ENTRIES_SCHEMA }> {
        return z.object({ dir, entries: TRANSFER_ENTRIES_SCHEMA });
    }

    /**
     * Returns the upload entry schema
     *
     * @returns Validation schema
     */
    static getUploadEntrySchema(): z.ZodObject<{
        id: typeof idSchema.shape.id;
        path: typeof PATH_SCHEMA;
        offset: typeof OFFSET_SCHEMA;
    }> {
        return z.object({ id: idSchema.shape.id, path: PATH_SCHEMA, offset: OFFSET_SCHEMA });
    }

    /**
     * Returns the transfer session schema
     *
     * @returns Validation schema
     */
    static getTransferSchema(): z.ZodObject<typeof idSchema.shape> {
        return idSchema;
    }

    /**
     * Returns the download session schema
     *
     * @returns Validation schema
     */
    static getCreateDownloadSchema(): z.ZodObject<{ dir: typeof dir; entries: typeof ENTRIES_SCHEMA }> {
        return z.object({ dir, entries: ENTRIES_SCHEMA });
    }

    /**
     * Returns the download entry schema
     *
     * @returns Validation schema
     */
    static getDownloadEntrySchema(): z.ZodObject<{
        id: typeof idSchema.shape.id;
        path: typeof PATH_SCHEMA;
        offset: typeof OFFSET_SCHEMA;
    }> {
        return z.object({ id: idSchema.shape.id, path: PATH_SCHEMA, offset: OFFSET_SCHEMA });
    }

    /**
     * Returns the deletion schema
     *
     * @returns Validation schema
     */
    static getDeleteSchema(): z.ZodObject<{ dir: typeof dir; entries: typeof ENTRIES_SCHEMA }> {
        return z.object({ dir, entries: ENTRIES_SCHEMA });
    }

    private static renameCases({ entry, newName }: FtpRenameSchemaData, ctx: RefinementCtx): void {
        return handleValidationIssues(
            [{ condition: entry.name === newName, path: ["newName"], message: "El nuevo nombre debe ser diferente" }],
            ctx
        );
    }

    private static moveCases({ dir, destination }: FtpMoveSchemaData, ctx: RefinementCtx): void {
        return handleValidationIssues(
            [
                {
                    condition: dir === destination,
                    path: ["destination"],
                    message: "El destino debe ser diferente al origen"
                }
            ],
            ctx
        );
    }
}
