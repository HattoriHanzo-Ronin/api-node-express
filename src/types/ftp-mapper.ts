import type { FtpEntry } from "./ftp-service.js";
export type FtpEntrySource = FtpEntry & { size: number; modifyTime: number; supportsThumbnail: boolean };
export type FtpDomainEntry = FtpEntry & { supportsThumbnail?: boolean };
