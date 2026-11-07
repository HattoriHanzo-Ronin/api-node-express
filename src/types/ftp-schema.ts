import type { FtpMoveParams, FtpRenameParams } from "./ftp-service.js";

export type FtpMoveSchemaData = Pick<FtpMoveParams, "dir" | "entries" | "destination">;
export type FtpRenameSchemaData = Pick<FtpRenameParams, "dir" | "entry" | "newName">;
