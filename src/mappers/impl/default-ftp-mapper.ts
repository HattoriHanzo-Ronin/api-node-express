import type { FtpSourceEntry } from "../../types/default-ftp-service.js";
import path from "node:path";
import type { FtpDomainEntry, FtpEntrySource } from "../../types/ftp-mapper.js";
import { FILE_TYPE } from "../../config/constants.js";

const { dir, file } = FILE_TYPE;

/**
 * Default FTP mapper
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultFtpMapper {
    private static readonly MEDIA_EXTENSION =
        /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic|heif|mp4|m4v|mov|mkv|webm|avi|mpeg|mpg|wmv|flv|3gp|mts|m2ts|ogv)$/i;

    static entriesFromSource(source: FtpSourceEntry[]): FtpEntrySource[] {
        return source.map(({ name, type, size, modifyTime }) => {
            const normalizedType = type === "d" ? dir : file;
            return {
                name,
                type: normalizedType,
                size,
                modifyTime,
                supportsThumbnail: normalizedType === file && DefaultFtpMapper.MEDIA_EXTENSION.test(path.extname(name))
            };
        });
    }

    static entryToDomain(source: FtpEntrySource): FtpDomainEntry {
        const { name, type, supportsThumbnail } = source;
        const entry = { name, type };
        return type === file ? { ...entry, supportsThumbnail } : entry;
    }

    static entriesToDomain(source: FtpEntrySource[]): FtpDomainEntry[] {
        return source.map((entry) => DefaultFtpMapper.entryToDomain(entry));
    }
}
